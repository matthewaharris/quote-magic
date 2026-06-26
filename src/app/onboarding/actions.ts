"use server";

import { cookies } from "next/headers";
import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";
import { scrapeAndStoreLogo } from "@/lib/logo";
import { sendEmail, actionEmailHtml, escapeHtml } from "@/lib/email";
import { isDisposableEmail } from "@/lib/abuse";
import { verifyTurnstile } from "@/lib/turnstile";

// Founder alert: email when a brand-new contractor finishes onboarding.
// Fires once (the caller guards on first completion). Recipient is the
// SIGNUP_NOTIFY_EMAIL env var — unset = no notification. Never throws.
async function notifyNewSignup(input: {
  contractorId: string;
  name: string;
  businessName: string;
  phone: string;
  email: string | null;
}) {
  try {
    const to = process.env.SIGNUP_NOTIFY_EMAIL;
    if (!to) return;

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://quotemagic.app";
    const rows = [
      `<strong>${escapeHtml(input.name)}</strong>`,
      input.businessName ? `Business: ${escapeHtml(input.businessName)}` : "",
      input.phone ? `Phone: ${escapeHtml(input.phone)}` : "",
      input.email ? `Email: ${escapeHtml(input.email)}` : "",
    ]
      .filter(Boolean)
      .join("<br>");

    await sendEmail({
      to,
      subject: `🎉 New QuoteMagic signup: ${input.name}${input.businessName ? ` (${input.businessName})` : ""}`,
      html: actionEmailHtml({
        heading: "New signup",
        body: rows,
        url: `${base}/admin/${input.contractorId}`,
        cta: "Open in admin",
      }),
    });
  } catch {
    // A notification must never affect the signup flow.
  }
}

// Consume the qm_ref cookie (set by the proxy on ?ref= visits): record who
// referred this contractor and give the referrer +10 trial quotes. All
// writes go through the service-role client — referred_by and
// trial_quote_limit are column-locked against user-scoped updates.
async function attributeReferral(contractorId: string) {
  try {
    const cookieStore = await cookies();
    const ref = cookieStore.get("qm_ref")?.value;
    if (!ref || ref === contractorId) return;

    const admin = createAdminClient();
    const { data: referrer } = await admin
      .from("contractors")
      .select("id, plan, trial_quote_limit")
      .eq("id", ref)
      .maybeSingle();
    if (!referrer) return;

    const { data: me } = await admin
      .from("contractors")
      .select("referred_by")
      .eq("id", contractorId)
      .single();
    if (me?.referred_by) return; // first attribution wins

    await admin
      .from("contractors")
      .update({ referred_by: referrer.id })
      .eq("id", contractorId);
    if (referrer.plan === "trial") {
      await admin
        .from("contractors")
        .update({ trial_quote_limit: referrer.trial_quote_limit + 10 })
        .eq("id", referrer.id);
    }
  } catch {
    // Referral attribution must never block onboarding.
  }
}

export async function completeOnboarding(input: {
  name: string;
  phone: string;
  business_name: string;
  website_url: string;
  captchaToken?: string;
}) {
  const { supabase, contractor } = await requireContractor();

  if (isDisposableEmail(contractor.email)) {
    return {
      ok: false,
      message:
        "Please sign up with a permanent email address — disposable inboxes aren't supported.",
    };
  }

  // No-op unless TURNSTILE_SECRET_KEY is set (see src/lib/turnstile.ts).
  const captcha = await verifyTurnstile(input.captchaToken);
  if (!captcha.ok) {
    return { ok: false, message: "Please complete the verification and try again." };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, message: "Please tell us your name." };
  const websiteUrl = input.website_url.trim();

  // Only the FIRST completion is a new signup — re-running onboarding (e.g.
  // editing the profile) must not re-notify.
  const isFirstCompletion = !contractor.onboarded_at;

  // Mark onboarding complete before attempting the logo scrape — a flaky
  // website must never strand the contractor on this screen.
  const { error } = await supabase
    .from("contractors")
    .update({
      name,
      phone: input.phone.trim() || null,
      business_name: input.business_name.trim(),
      website_url: websiteUrl || null,
      onboarded_at: contractor.onboarded_at ?? new Date().toISOString(),
    })
    .eq("id", contractor.id);
  if (error) return { ok: false, message: error.message };

  await attributeReferral(contractor.id);

  if (isFirstCompletion) {
    await notifyNewSignup({
      contractorId: contractor.id,
      name,
      businessName: input.business_name.trim(),
      phone: input.phone.trim(),
      email: contractor.email,
    });
  }

  if (websiteUrl) {
    try {
      await scrapeAndStoreLogo(websiteUrl, contractor.id);
    } catch {
      // best effort only
    }
  }

  return { ok: true };
}
