import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";
import { paymentsMode } from "@/lib/payments";

// DEMO checkout: accepts any card input, records a simulated payment.
// No card data is stored or sent anywhere.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // In manual mode this endpoint must not exist — it would let anyone
  // mark a real invoice paid. Contractors record payments from JobPanel.
  if (paymentsMode() !== "demo") {
    return NextResponse.json(
      { error: "Online payment is not enabled." },
      { status: 403 }
    );
  }
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, contractor_id, title")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, number, total, status")
    .eq("job_id", job.id)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: "No invoice yet" }, { status: 409 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  const paymentRef = `SIM-${randomBytes(4).toString("hex")}`;
  const paidAt = new Date().toISOString();

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt, payment_ref: paymentRef })
    .eq("id", invoice.id);
  await supabase.from("jobs").update({ status: "paid" }).eq("id", job.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: "paid",
    meta: { number: invoice.number, payment_ref: paymentRef },
  });

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email")
    .eq("id", quote.contractor_id)
    .single();
  if (contractor?.email) {
    await sendEmail({
      to: contractor.email,
      subject: `🎉 Paid: invoice ${invoice.number} — ${formatMoney(Number(invoice.total))}`,
      html: actionEmailHtml({
        heading: "You got paid",
        body: `Invoice <strong>${invoice.number}</strong> for "<strong>${quote.title}</strong>" was paid (${formatMoney(Number(invoice.total))}). Ref: ${paymentRef}. <em>Simulated payment — no real funds moved.</em>`,
      }),
    });
  }

  return NextResponse.json({ ok: true, payment_ref: paymentRef });
}
