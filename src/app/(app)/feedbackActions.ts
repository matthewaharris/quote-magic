"use server";

import { requireContractor } from "@/lib/contractor";
import { sendEmail, actionEmailHtml, escapeHtml } from "@/lib/email";
import type { FeedbackType } from "@/lib/types";

const TYPES: FeedbackType[] = ["bug", "feature", "other"];

// Founder alert: email when a contractor submits feedback. Dormant by design —
// the recipient is the FEEDBACK_NOTIFY_EMAIL env var, so leaving it unset means
// no email (triage in /admin/feedback only). Set it later to turn alerts on.
// Mirrors notifyNewSignup. Never throws.
async function notifyNewFeedback(input: {
  contractorId: string;
  type: FeedbackType;
  message: string;
  pageUrl: string | null;
  who: string;
}) {
  try {
    const to = process.env.FEEDBACK_NOTIFY_EMAIL;
    if (!to) return;

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://quotemagic.app";
    const rows = [
      `<strong>${escapeHtml(input.type)}</strong> from ${escapeHtml(input.who)}`,
      input.pageUrl ? `On: ${escapeHtml(input.pageUrl)}` : "",
      "",
      escapeHtml(input.message).replace(/\n/g, "<br>"),
    ]
      .filter((r) => r !== "")
      .join("<br>");

    await sendEmail({
      to,
      subject: `💬 QuoteMagic ${input.type}: ${input.message.slice(0, 60)}`,
      html: actionEmailHtml({
        heading: "New feedback",
        body: rows,
        url: `${base}/admin/feedback`,
        cta: "Open feedback triage",
      }),
    });
  } catch {
    // A notification must never affect the submit flow.
  }
}

export async function submitFeedback(input: {
  type: string;
  message: string;
  pageUrl: string;
}): Promise<{ ok: boolean; message?: string }> {
  const { supabase, contractor } = await requireContractor();

  const message = input.message.trim();
  if (!message) return { ok: false, message: "Please describe your feedback." };
  if (message.length > 4000) {
    return { ok: false, message: "That's a bit long — please trim it down." };
  }
  const type: FeedbackType = TYPES.includes(input.type as FeedbackType)
    ? (input.type as FeedbackType)
    : "other";
  const pageUrl = input.pageUrl.trim().slice(0, 500) || null;

  const { error } = await supabase.from("feedback").insert({
    contractor_id: contractor.id,
    type,
    message,
    page_url: pageUrl,
  });
  if (error) return { ok: false, message: error.message };

  await notifyNewFeedback({
    contractorId: contractor.id,
    type,
    message,
    pageUrl,
    who: contractor.business_name || contractor.name || contractor.email || "—",
  });

  return { ok: true };
}
