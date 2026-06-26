import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actionEmailHtml, escapeHtml, sendEmail } from "@/lib/email";
import { issueInvoice } from "@/lib/invoice";

// Customer confirms the job is complete (or flags a problem).
// On confirm, the invoice is issued immediately.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: "confirm" | "dispute";
    note?: string;
  } | null;
  if (body?.action !== "confirm" && body?.action !== "dispute") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, contractor_id, title")
    .eq("share_token", token)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, quote_id, contractor_id, status")
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!job || job.status !== "done_reported") {
    return NextResponse.json(
      { error: "Nothing awaiting confirmation." },
      { status: 409 }
    );
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("email")
    .eq("id", quote.contractor_id)
    .single();

  if (body.action === "dispute") {
    // Don't change state — just flag the contractor.
    if (contractor?.email) {
      await sendEmail({
        to: contractor.email,
        subject: `⚠️ Customer flagged an issue: ${quote.title}`,
        html: actionEmailHtml({
          heading: "Customer says something's not right",
          body: body.note
            ? `Their note: "${escapeHtml(body.note)}"`
            : "They flagged the completion without a note — reach out to them.",
        }),
      });
    }
    return NextResponse.json({ ok: true, flagged: true });
  }

  await supabase
    .from("jobs")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", job.id);
  await supabase
    .from("quote_events")
    .insert({ quote_id: quote.id, type: "confirmed" });

  const result = await issueInvoice(supabase, job);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  if (contractor?.email) {
    await sendEmail({
      to: contractor.email,
      subject: `✅ Completion confirmed, invoice ${result.invoice.number} sent: ${quote.title}`,
      html: actionEmailHtml({
        heading: "Job confirmed complete",
        body: `The customer confirmed "<strong>${escapeHtml(quote.title)}</strong>". Invoice <strong>${escapeHtml(result.invoice.number)}</strong> was issued automatically.`,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
