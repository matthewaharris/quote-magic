import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, sendEmail } from "@/lib/email";

// Customer approves or declines a change order via the quote share token.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: "approve" | "decline";
  } | null;
  if (body?.action !== "approve" && body?.action !== "decline") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, title, contractor_id")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The CO must belong to this quote — no cross-quote id probing.
  const { data: co } = await supabase
    .from("change_orders")
    .select("id, job_id, title, amount, status")
    .eq("id", id)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (co.status !== "pending") {
    return NextResponse.json({ error: "Already answered" }, { status: 409 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("job_id", co.job_id)
    .maybeSingle();
  if (invoice) {
    return NextResponse.json(
      { error: "Invoice already issued — contact your contractor." },
      { status: 409 }
    );
  }

  const newStatus = body.action === "approve" ? "approved" : "declined";
  await supabase
    .from("change_orders")
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq("id", co.id);
  await supabase.from("quote_events").insert({
    quote_id: quote.id,
    type: body.action === "approve" ? "change_order_approved" : "change_order_declined",
    meta: { change_order_id: co.id, title: co.title, amount: Number(co.amount) },
  });

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email")
    .eq("id", quote.contractor_id)
    .single();
  if (contractor?.email) {
    await sendEmail({
      to: contractor.email,
      subject: `Change order ${newStatus}: ${co.title} ($${Number(co.amount).toFixed(2)}) — ${quote.title}`,
      html: actionEmailHtml({
        heading: `Change order ${newStatus}`,
        body: `The customer ${newStatus} "<strong>${co.title}</strong>" ($${Number(co.amount).toFixed(2)}) on "<strong>${quote.title}</strong>".${newStatus === "approved" ? " It will be added to the invoice." : ""}`,
      }),
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
