"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

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
