import { NextResponse } from "next/server";
import { getContractor } from "@/lib/contractor";
import {
  generateQuote,
  generateTieredQuote,
  type QuoteImage,
} from "@/lib/ai/quote";
import { getTrialStatus } from "@/lib/trial";
import type { PriceBookItem } from "@/lib/types";

export const maxDuration = 120;

export async function POST(request: Request) {
  const ctx = await getContractor();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, contractor } = ctx;

  if (contractor.plan === "disabled") {
    return NextResponse.json(
      { error: "This account is disabled.", code: "ACCOUNT_DISABLED" },
      { status: 403 }
    );
  }

  const trial = await getTrialStatus(supabase, contractor);
  if (trial.expired) {
    return NextResponse.json(
      {
        error: "Your free trial has ended.",
        code: "TRIAL_LIMIT",
        quotesUsed: trial.quotesUsed,
        daysLeft: trial.daysLeft,
      },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    transcript?: string;
    tiered?: boolean;
    images?: { media_type?: string; data?: string }[];
  } | null;
  const transcript = body?.transcript?.trim();
  if (!transcript || transcript.length < 10) {
    return NextResponse.json(
      { error: "Please describe the job too — photos support your description." },
      { status: 400 }
    );
  }

  // Optional job-site photos: validated hard — they go straight to the model.
  const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const MAX_IMAGE_B64 = 1_400_000; // ~1 MB binary each
  const MAX_TOTAL_B64 = 4_700_000; // ~3.5 MB binary total
  let images: QuoteImage[] | undefined;
  if (body?.images?.length) {
    if (!Array.isArray(body.images) || body.images.length > 4) {
      return NextResponse.json(
        { error: "Up to 4 photos per quote." },
        { status: 400 }
      );
    }
    let total = 0;
    images = [];
    for (const img of body.images) {
      if (
        !img?.data ||
        typeof img.data !== "string" ||
        !ALLOWED_MEDIA.includes(img.media_type ?? "")
      ) {
        return NextResponse.json(
          { error: "Couldn't read one of the photos." },
          { status: 400 }
        );
      }
      total += img.data.length;
      if (img.data.length > MAX_IMAGE_B64 || total > MAX_TOTAL_B64) {
        return NextResponse.json(
          { error: "Photos too large — try fewer or smaller photos." },
          { status: 413 }
        );
      }
      images.push({
        media_type: img.media_type as QuoteImage["media_type"],
        data: img.data,
      });
    }
  }

  const { data: pbData } = await supabase
    .from("price_book_items")
    .select("*")
    .eq("contractor_id", contractor.id);
  const priceBook = (pbData ?? []) as PriceBookItem[];

  // Never trust model arithmetic — recompute all money/time on the server.
  const validPbIds = new Set(priceBook.map((i) => i.id));
  type DraftLine = {
    matched_price_book_item_id: string | null;
    name: string;
    description: string;
    qty: number;
    unit: string;
    unit_price: number;
    est_minutes: number;
    confidence: number;
    is_new_item: boolean;
  };
  // Contractor pricing defaults: markup is baked into each line's unit
  // price (customers never see a separate markup row); the default tax rate
  // seeds the quote's tax field.
  const markupFactor =
    1 +
    Math.min(100, Math.max(0, Number(contractor.default_markup_percent))) / 100;
  const taxRate = Math.min(
    25,
    Math.max(0, Number(contractor.default_tax_rate))
  );

  function computeLines(draftLines: DraftLine[]) {
    const lines = draftLines.map((li, idx) => {
      const qty = Math.max(0, li.qty);
      const unitPrice =
        Math.round(Math.max(0, li.unit_price) * markupFactor * 100) / 100;
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
    const subtotal =
      Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
    const estTotalMinutes = lines.reduce((s, l) => s + l.est_minutes, 0);
    return { lines, subtotal, estTotalMinutes };
  }

  async function insertQuote(input: {
    title: string;
    jobSummary: string;
    assumptions: string[];
    questions: string[];
    draftLines: DraftLine[];
    tier?: "good" | "better" | "best";
    tierGroupId?: string;
  }) {
    const { lines, subtotal, estTotalMinutes } = computeLines(input.draftLines);
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        contractor_id: contractor.id,
        title: input.title,
        job_summary: input.jobSummary,
        dictation_transcript: transcript,
        subtotal,
        tax_rate: taxRate,
        total: Math.round(subtotal * (1 + taxRate / 100) * 100) / 100,
        est_total_minutes: estTotalMinutes,
        assumptions: input.assumptions,
        questions: input.questions,
        tier: input.tier ?? null,
        tier_group_id: input.tierGroupId ?? null,
      })
      .select("id")
      .single();
    if (quoteError || !quote) {
      console.error("quote insert failed:", quoteError);
      return null;
    }
    const { error: linesError } = await supabase
      .from("quote_line_items")
      .insert(lines.map((l) => ({ ...l, quote_id: quote.id })));
    if (linesError) {
      console.error("line items insert failed:", linesError);
      return null;
    }
    await supabase.from("quote_events").insert({
      quote_id: quote.id,
      type: "created",
      meta: {
        source: "dictation",
        photo_count: images?.length ?? 0,
        ...(input.tier
          ? { tier: input.tier, tier_group_id: input.tierGroupId }
          : {}),
      },
    });
    return quote.id as string;
  }

  const aiInput = {
    transcript,
    priceBook,
    hourlyRate: Number(contractor.hourly_rate),
    trade: contractor.trade,
    images,
  };

  if (body?.tiered) {
    let draft;
    try {
      draft = await generateTieredQuote(aiInput);
    } catch (err) {
      console.error("generateTieredQuote failed:", err);
      return NextResponse.json(
        { error: "Quote generation failed. Try again." },
        { status: 502 }
      );
    }
    const tierGroupId = crypto.randomUUID();
    let betterId: string | null = null;
    for (const tier of ["good", "better", "best"] as const) {
      const variant = draft[tier];
      const id = await insertQuote({
        title: draft.title,
        jobSummary: `${draft.job_summary} ${variant.tier_summary}`.trim(),
        assumptions: draft.assumptions,
        questions: draft.questions_for_contractor,
        draftLines: variant.line_items,
        tier,
        tierGroupId,
      });
      if (!id) {
        return NextResponse.json(
          { error: "Could not save quote." },
          { status: 500 }
        );
      }
      if (tier === "better") betterId = id;
    }
    return NextResponse.json({ id: betterId });
  }

  let draft;
  try {
    draft = await generateQuote(aiInput);
  } catch (err) {
    console.error("generateQuote failed:", err);
    return NextResponse.json(
      { error: "Quote generation failed. Try again." },
      { status: 502 }
    );
  }

  const id = await insertQuote({
    title: draft.title,
    jobSummary: draft.job_summary,
    assumptions: draft.assumptions,
    questions: draft.questions_for_contractor,
    draftLines: draft.line_items,
  });
  if (!id) {
    return NextResponse.json({ error: "Could not save quote." }, { status: 500 });
  }

  return NextResponse.json({ id });
}
