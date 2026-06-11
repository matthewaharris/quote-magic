import { NextResponse } from "next/server";
import { getContractor } from "@/lib/contractor";
import { quoteEmailHtml, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getContractor();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, contractor } = ctx;

  const body = (await request.json().catch(() => null)) as {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    via: "email" | "link";
  } | null;
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("contractor_id", contractor.id)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Upsert a customer record when we have any contact details.
  let customerId = quote.customer_id as string | null;
  if (body.customer_name || body.customer_email || body.customer_phone) {
    const { data: customer } = await supabase
      .from("customers")
      .insert({
        contractor_id: contractor.id,
        name: body.customer_name || "Customer",
        email: body.customer_email || null,
        phone: body.customer_phone || null,
      })
      .select("id")
      .single();
    if (customer) customerId = customer.id;
  }

  // For good/better/best groups the shared link is always the 'better' row
  // (the customer-side tier switcher entry point), and all siblings move to
  // 'sent' together so any tier can be accepted.
  let shareToken = quote.share_token as string;
  let siblingIds: string[] = [];
  if (quote.tier_group_id) {
    const { data: siblings } = await supabase
      .from("quotes")
      .select("id, tier, share_token")
      .eq("tier_group_id", quote.tier_group_id);
    siblingIds = (siblings ?? []).map((s) => s.id);
    shareToken =
      (siblings ?? []).find((s) => s.tier === "better")?.share_token ??
      shareToken;
  }
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/q/${shareToken}`;

  let emailResult: { ok: boolean; stubbed: boolean } | null = null;
  if (body.via === "email" && body.customer_email) {
    emailResult = await sendEmail({
      to: body.customer_email,
      subject: `Quote from ${contractor.business_name || "your contractor"}: ${quote.title} — ${formatMoney(Number(quote.total))}`,
      html: quoteEmailHtml({
        businessName: contractor.business_name || "Your contractor",
        title: quote.title,
        total: formatMoney(Number(quote.total)),
        url,
        logoUrl: contractor.logo_url,
      }),
    });
    if (!emailResult.ok) {
      return NextResponse.json(
        { error: "Email failed to send." },
        { status: 502 }
      );
    }
  }

  // Only move draft -> sent forward; never regress an accepted quote.
  // Tier groups move together.
  const targetIds = siblingIds.length > 0 ? siblingIds : [id];
  if (quote.status === "draft") {
    await supabase
      .from("quotes")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        customer_id: customerId,
      })
      .in("id", targetIds)
      .eq("status", "draft");
  } else if (customerId !== quote.customer_id) {
    await supabase
      .from("quotes")
      .update({ customer_id: customerId })
      .in("id", targetIds);
  }

  await supabase.from("quote_events").insert({
    quote_id: id,
    type: "sent",
    meta: { via: body.via, email_stubbed: emailResult?.stubbed ?? null },
  });

  return NextResponse.json({ ok: true, url });
}
