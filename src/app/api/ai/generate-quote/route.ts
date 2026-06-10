import { NextResponse } from "next/server";
import { getContractor } from "@/lib/contractor";
import { generateQuote } from "@/lib/ai/quote";
import type { PriceBookItem } from "@/lib/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  const ctx = await getContractor();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, contractor } = ctx;

  const body = (await request.json().catch(() => null)) as {
    transcript?: string;
  } | null;
  const transcript = body?.transcript?.trim();
  if (!transcript || transcript.length < 10) {
    return NextResponse.json(
      { error: "Please describe the job first." },
      { status: 400 }
    );
  }

  const { data: pbData } = await supabase
    .from("price_book_items")
    .select("*")
    .eq("contractor_id", contractor.id);
  const priceBook = (pbData ?? []) as PriceBookItem[];

  let draft;
  try {
    draft = await generateQuote({
      transcript,
      priceBook,
      hourlyRate: Number(contractor.hourly_rate),
      trade: contractor.trade,
    });
  } catch (err) {
    console.error("generateQuote failed:", err);
    return NextResponse.json(
      { error: "Quote generation failed. Try again." },
      { status: 502 }
    );
  }

  // Never trust model arithmetic — recompute all money/time on the server.
  const validPbIds = new Set(priceBook.map((i) => i.id));
  const lines = draft.line_items.map((li, idx) => {
    const qty = Math.max(0, li.qty);
    const unitPrice = Math.max(0, li.unit_price);
    return {
      price_book_item_id:
        li.matched_price_book_item_id &&
        validPbIds.has(li.matched_price_book_item_id)
          ? li.matched_price_book_item_id
          : null,
      name: li.name,
      description: li.description,
      qty,
      unit: li.unit,
      unit_price: unitPrice,
      line_total: Math.round(qty * unitPrice * 100) / 100,
      est_minutes: Math.max(0, Math.round(li.est_minutes)),
      ai_confidence: Math.min(1, Math.max(0, li.confidence)),
      is_new_item: li.is_new_item || !li.matched_price_book_item_id,
      sort_order: idx,
    };
  });

  const subtotal = Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  const estTotalMinutes = lines.reduce((s, l) => s + l.est_minutes, 0);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      contractor_id: contractor.id,
      title: draft.title,
      job_summary: draft.job_summary,
      dictation_transcript: transcript,
      subtotal,
      total: subtotal,
      est_total_minutes: estTotalMinutes,
      assumptions: draft.assumptions,
      questions: draft.questions_for_contractor,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    console.error("quote insert failed:", quoteError);
    return NextResponse.json({ error: "Could not save quote." }, { status: 500 });
  }

  const { error: linesError } = await supabase
    .from("quote_line_items")
    .insert(lines.map((l) => ({ ...l, quote_id: quote.id })));

  if (linesError) {
    console.error("line items insert failed:", linesError);
    return NextResponse.json({ error: "Could not save quote." }, { status: 500 });
  }

  await supabase
    .from("quote_events")
    .insert({ quote_id: quote.id, type: "created", meta: { source: "dictation" } });

  return NextResponse.json({ id: quote.id });
}
