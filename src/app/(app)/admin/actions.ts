"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { FeedbackStatus } from "@/lib/types";

const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "open",
  "planned",
  "in_progress",
  "done",
  "declined",
];

// Triage a feedback row: set its status and/or private notes. Service-role
// write — feedback has no user-scoped update policy (migration 0014).
export async function updateFeedback(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const status = String(formData.get("status") ?? "");
  const adminNotes = String(formData.get("admin_notes") ?? "").trim();
  const patch: { status?: FeedbackStatus; admin_notes: string | null; updated_at: string } = {
    admin_notes: adminNotes || null,
    updated_at: new Date().toISOString(),
  };
  if (FEEDBACK_STATUSES.includes(status as FeedbackStatus)) {
    patch.status = status as FeedbackStatus;
  }
  await admin.from("feedback").update(patch).eq("id", id);
  revalidatePath("/admin/feedback");
}

// ── Changelog authoring (service-role; changelog_entries is write-locked to
// the user client by migration 0014). ──────────────────────────────────────

export async function createChangelogEntry(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const version = String(formData.get("version") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const publish = formData.get("publish") === "on";
  await admin.from("changelog_entries").insert({
    title,
    version,
    body,
    published_at: publish ? new Date().toISOString() : null,
  });
  revalidatePath("/admin/changelog");
}

export async function updateChangelogEntry(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!id || !title) return;
  await admin
    .from("changelog_entries")
    .update({
      title,
      version: String(formData.get("version") ?? "").trim() || null,
      body: String(formData.get("body") ?? "").trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/changelog");
}

// Flip draft ⇄ published. Publishing stamps published_at = now (so it sorts to
// the top of What's new and triggers the unseen dot); unpublishing clears it.
export async function toggleChangelogPublish(id: string): Promise<void> {
  const { admin } = await requireAdmin();
  const { data: entry } = await admin
    .from("changelog_entries")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (!entry) return;
  await admin
    .from("changelog_entries")
    .update({
      published_at: entry.published_at ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin/changelog");
}

export async function deleteChangelogEntry(id: string): Promise<void> {
  const { admin } = await requireAdmin();
  await admin.from("changelog_entries").delete().eq("id", id);
  revalidatePath("/admin/changelog");
}

// Global new-signup trial length. Service-role write (app_settings is locked
// to service-role only). Affects only future signups — existing trials keep
// the trial_ends_at set when they were created.
export async function setGlobalTrialDays(formData: FormData): Promise<void> {
  const { admin } = await requireAdmin();
  const raw = Number(formData.get("trial_days"));
  if (!Number.isFinite(raw)) return;
  const clamped = Math.min(365, Math.max(1, Math.round(raw)));
  await admin
    .from("app_settings")
    .update({ trial_days: clamped, updated_at: new Date().toISOString() })
    .eq("id", 1);
  revalidatePath("/admin");
  // Marketing pages prerender the trial length as static HTML — bust their
  // caches so the advertised number updates on the next visit.
  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/terms");
  revalidatePath("/demo");
  revalidatePath("/for/[trade]", "page");
}

// All plan/trial changes go through the service-role client — these columns
// are locked against user-scoped writes (migration 0004). Guard failures are
// silent no-ops (the UI hides invalid buttons; this is defense in depth).

export async function compContractor(contractorId: string): Promise<void> {
  const { admin } = await requireAdmin();
  await admin
    .from("contractors")
    .update({ plan: "comp" })
    .eq("id", contractorId);
  revalidatePath("/admin");
}

export async function extendTrial(contractorId: string): Promise<void> {
  const { admin } = await requireAdmin();
  const { data: target } = await admin
    .from("contractors")
    .select("plan, trial_ends_at, trial_quote_limit")
    .eq("id", contractorId)
    .maybeSingle();
  if (!target || target.plan !== "trial") {
    console.warn("extendTrial: target not on trial, skipping");
    return;
  }
  const base = Math.max(Date.now(), new Date(target.trial_ends_at).getTime());
  await admin
    .from("contractors")
    .update({
      trial_ends_at: new Date(base + 14 * 24 * 60 * 60 * 1000).toISOString(),
      trial_quote_limit: target.trial_quote_limit + 25,
    })
    .eq("id", contractorId);
  revalidatePath("/admin");
}

// Flag/unflag an account as internal/test — hides it from the /admin stats.
// Service-role write; is_test is column-locked against the user client (0015).
export async function toggleTestAccount(contractorId: string): Promise<void> {
  const { admin } = await requireAdmin();
  const { data: target } = await admin
    .from("contractors")
    .select("is_test")
    .eq("id", contractorId)
    .maybeSingle();
  if (!target) return;
  await admin
    .from("contractors")
    .update({ is_test: !target.is_test })
    .eq("id", contractorId);
  revalidatePath("/admin");
}

export async function disableContractor(contractorId: string): Promise<void> {
  const { contractor: me, admin } = await requireAdmin();
  if (contractorId === me.id) {
    console.warn("disableContractor: refusing to disable self");
    return;
  }
  await admin
    .from("contractors")
    .update({ plan: "disabled" })
    .eq("id", contractorId);
  revalidatePath("/admin");
}

// Support tool: a single-use sign-in link for this contractor (same security
// model as the magic-link URL in their email — the token_hash is the secret,
// it's one-shot and expires). Returned to a client component via
// useActionState, since plain <form action> discards return values.
export async function generateLoginLink(
  contractorId: string,
  _prev: { url?: string; error?: string } | null
): Promise<{ url?: string; error?: string }> {
  const { admin } = await requireAdmin();
  const { data: target } = await admin
    .from("contractors")
    .select("email")
    .eq("id", contractorId)
    .maybeSingle();
  if (!target?.email) return { error: "No email on file for this contractor." };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  if (error || !data) {
    return { error: error?.message ?? "Could not generate link." };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    url: `${base}/api/admin/login?token_hash=${encodeURIComponent(
      data.properties.hashed_token
    )}`,
  };
}

// Re-enable as a fresh, honest trial: 14 days and exactly 25 usable quotes
// regardless of how many they generated before being disabled.
export async function reenableContractor(contractorId: string): Promise<void> {
  const { admin } = await requireAdmin();
  const { data: target } = await admin
    .from("contractors")
    .select("plan")
    .eq("id", contractorId)
    .maybeSingle();
  if (!target || target.plan !== "disabled") {
    console.warn("reenableContractor: target not disabled, skipping");
    return;
  }
  const { count } = await admin
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractorId);
  await admin
    .from("contractors")
    .update({
      plan: "trial",
      trial_ends_at: new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toISOString(),
      trial_quote_limit: (count ?? 0) + 25,
    })
    .eq("id", contractorId);
  revalidatePath("/admin");
}
