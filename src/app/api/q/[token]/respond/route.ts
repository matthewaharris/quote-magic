import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";

// Public endpoint: customer accepts or declines a quote via its share token.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: "accept" | "decline";
  } | null;
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, title, total, contractor_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (quote.status === "accepted" || quote.status === "declined") {
    return NextResponse.json({ error: "Already responded" }, { status: 409 });
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email, business_name, deposit_percent")
    .eq("id", quote.contractor_id)
    .single();

  // Deposit is frozen at acceptance time — later changes to the
  // contractor's deposit_percent never touch existing jobs.
  const pct = Math.min(100, Math.max(0, Number(contractor?.deposit_percent ?? 0)));
  const depositAmount =
    pct > 0 ? Math.round(Number(quote.total) * pct) / 100 : 0;

  const newStatus = action === "accept" ? "accepted" : "declined";
  await supabase
    .from("quotes")
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq("id", quote.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: newStatus,
    meta: action === "accept" ? { deposit_amount: depositAmount } : {},
  });

  // Acceptance opens a job — this drives scheduling and the rest of the
  // post-accept lifecycle.
  if (action === "accept") {
    await supabase
      .from("jobs")
      .upsert(
        {
          quote_id: quote.id,
          contractor_id: quote.contractor_id,
          deposit_amount: depositAmount,
        },
        { onConflict: "quote_id", ignoreDuplicates: true }
      );
  }

  if (contractor?.email) {
    await sendEmail({
      to: contractor.email,
      subject:
        action === "accept"
          ? `✅ Quote accepted: ${quote.title} — ${formatMoney(Number(quote.total))}`
          : `Quote declined: ${quote.title}`,
      html: `<p>Your quote "<strong>${quote.title}</strong>" (${formatMoney(
        Number(quote.total)
      )}) was <strong>${newStatus}</strong> by the customer.</p>`,
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
