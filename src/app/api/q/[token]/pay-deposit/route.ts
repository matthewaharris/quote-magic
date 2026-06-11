import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";

// DEMO deposit payment — same simulated checkout as the invoice pay route.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
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
    .select("id, status, deposit_amount, deposit_paid_at")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "No job" }, { status: 404 });

  if (Number(job.deposit_amount) <= 0) {
    return NextResponse.json({ error: "No deposit due" }, { status: 409 });
  }
  if (job.deposit_paid_at) {
    return NextResponse.json({ error: "Deposit already paid" }, { status: 409 });
  }
  if (job.status !== "unscheduled") {
    return NextResponse.json(
      { error: "Deposit can only be paid before scheduling" },
      { status: 409 }
    );
  }

  const depositRef = `SIM-${randomBytes(4).toString("hex")}`;
  await supabase
    .from("jobs")
    .update({
      deposit_paid_at: new Date().toISOString(),
      deposit_ref: depositRef,
    })
    .eq("id", job.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: "deposit_paid",
    meta: { amount: Number(job.deposit_amount), ref: depositRef },
  });

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email")
    .eq("id", quote.contractor_id)
    .single();
  if (contractor?.email) {
    await sendEmail({
      to: contractor.email,
      subject: `💰 Deposit received: ${formatMoney(Number(job.deposit_amount))} — ${quote.title}`,
      html: actionEmailHtml({
        heading: "Deposit received",
        body: `The customer paid a <strong>${formatMoney(Number(job.deposit_amount))}</strong> deposit on "<strong>${quote.title}</strong>". Ref: ${depositRef}. <em>Simulated payment — no real funds moved.</em>`,
      }),
    });
  }

  return NextResponse.json({ ok: true, deposit_ref: depositRef });
}
