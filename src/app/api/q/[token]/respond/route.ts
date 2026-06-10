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

  const newStatus = action === "accept" ? "accepted" : "declined";
  await supabase
    .from("quotes")
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq("id", quote.id);
  await supabase
    .from("quote_events")
    .insert({ quote_id: quote.id, type: newStatus });

  // Notify the contractor.
  const { data: contractor } = await supabase
    .from("contractors")
    .select("email, business_name")
    .eq("id", quote.contractor_id)
    .single();

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
