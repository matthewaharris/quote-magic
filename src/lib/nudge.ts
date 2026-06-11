import type { SupabaseClient } from "@supabase/supabase-js";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";

const NUDGE_AFTER_HOURS = 48;
const MAX_QUOTE_AGE_DAYS = 30;

// Sends the customer a gentle reminder about an unanswered quote.
// Works with the admin client (cron) or the RLS client (manual reminder —
// the contractor owns the quote, events, and customer rows it touches).
// force=true (manual) skips the 48h / already-nudged checks.
export async function sendNudge(
  supabase: SupabaseClient,
  quoteId: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; reason?: string }> {
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, status, title, total, share_token, customer_id, sent_at, responded_at, contractor_id"
    )
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, reason: "not found" };
  if (quote.responded_at) return { ok: false, reason: "already responded" };
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { ok: false, reason: `status ${quote.status}` };
  }
  if (!quote.customer_id) return { ok: false, reason: "no customer" };

  const { data: customer } = await supabase
    .from("customers")
    .select("email, name")
    .eq("id", quote.customer_id)
    .maybeSingle();
  if (!customer?.email) return { ok: false, reason: "no customer email" };

  if (!opts.force) {
    if (
      !quote.sent_at ||
      Date.now() - new Date(quote.sent_at).getTime() >
        MAX_QUOTE_AGE_DAYS * 24 * 60 * 60 * 1000
    ) {
      return { ok: false, reason: "too old" };
    }
    const { data: events } = await supabase
      .from("quote_events")
      .select("type, created_at")
      .eq("quote_id", quote.id)
      .in("type", ["viewed", "nudged"])
      .order("created_at", { ascending: false });
    if ((events ?? []).some((e) => e.type === "nudged")) {
      return { ok: false, reason: "already nudged" };
    }
    const lastViewed = (events ?? []).find((e) => e.type === "viewed");
    if (!lastViewed) return { ok: false, reason: "never viewed" };
    if (
      Date.now() - new Date(lastViewed.created_at).getTime() <
      NUDGE_AFTER_HOURS * 60 * 60 * 1000
    ) {
      return { ok: false, reason: "viewed too recently" };
    }
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("business_name, logo_url")
    .eq("id", quote.contractor_id)
    .single();
  const businessName = contractor?.business_name || "Your contractor";
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${quote.share_token}`;

  const result = await sendEmail({
    to: customer.email,
    subject: `Still thinking it over? Your quote from ${businessName}`,
    html: actionEmailHtml({
      heading: "Still thinking it over?",
      body: `Your quote for "<strong>${quote.title}</strong>" (${formatMoney(Number(quote.total))}) from ${businessName} is ready whenever you are — questions welcome.`,
      url,
      cta: "View your quote",
      brand: {
        businessName: contractor?.business_name,
        logoUrl: contractor?.logo_url,
      },
    }),
  });
  if (!result.ok) return { ok: false, reason: "email failed" };

  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: "nudged",
    meta: { source: opts.force ? "manual" : "cron" },
  });
  return { ok: true };
}
