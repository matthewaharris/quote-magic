import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { PriceBookItem } from "@/lib/types";
import {
  ExtractedPriceBook,
  QuoteDraft,
  TieredQuoteDraft,
  type ExtractedPriceBookT,
  type QuoteDraftT,
  type TieredQuoteDraftT,
} from "./schemas";

const MODEL = "claude-opus-4-8";

const client = new Anthropic();

const QUOTE_SYSTEM = `You are the quoting engine inside QuoteMagic, an app used by trade contractors (electricians, plumbers, landscapers, handymen) to turn a spoken job description into a structured quote.

You receive:
1. The contractor's price book: their own items with their own prices and time estimates. This is the source of truth for pricing.
2. The contractor's hourly labor rate, for work that is priced by time.
3. A dictated job description, transcribed from speech. Expect transcription noise: misheard words, missing punctuation, trade slang, and homophones (e.g. "breaker" vs "brake or"). Interpret it the way an experienced tradesperson would.

Build the quote:
- Decompose the dictation into discrete billable line items.
- Match each line to the single best price book item and use THAT item's unit price and per-unit minutes, scaled by quantity. Set matched_price_book_item_id to the item's id exactly as given.
- Quantities: extract explicit quantities and distances from the dictation (e.g. "about 20 feet" -> qty 20, unit foot). Round small buffers up sensibly (a "about 20 feet" run is often quoted at 25).
- If work is mentioned that no price book item covers, still include it: set is_new_item true, matched_price_book_item_id null, and give a best-guess fair market unit price and time. These get flagged for the contractor to price.
- Do not invent work that was not mentioned. Permits/inspection only if dictated or clearly legally required and present in the price book.
- est_minutes on each line is the TOTAL minutes for that line (per-unit minutes x qty).
- Assume a single-person crew unless the dictation says otherwise.
- Labor time includes realistic setup and cleanup, not just tool-on time.
- Typical consumables (fasteners, connectors, sealant) belong inside unit prices, not as surprise line items.
- Keep names and descriptions customer-friendly: no jargon the homeowner will not understand.
- List assumptions for anything ambiguous, and questions_for_contractor for things worth confirming before sending.

The contractor may provide their own standing quoting instructions (minimums, standard add-ons, crew details, travel charges). Apply them — they know their business — except where they conflict with the price book's prices or the structural rules above.

The contractor may attach job-site photos. Treat them as supporting evidence: identify visible scope, materials, quantities, and site conditions (panel space, wire runs, access difficulty) that refine the line items. Stay grounded — do not invent work that is neither visible in the photos nor dictated. When a photo contradicts the dictation, trust the dictation and note the discrepancy in assumptions.`;

export type QuoteImage = {
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string; // base64, no data: prefix
};

function buildQuoteContent(input: {
  transcript: string;
  priceBook: PriceBookItem[];
  hourlyRate: number;
  trade: string;
  instructions?: string | null;
  images?: QuoteImage[];
}) {
  const priceBookForPrompt = input.priceBook
    .map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      category: i.category,
      unit: i.unit,
      unit_price: Number(i.unit_cost),
      est_minutes_per_unit: i.est_minutes_per_unit,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const text = [
    `Trade: ${input.trade || "general contractor"}`,
    `Hourly labor rate: $${input.hourlyRate}/hr`,
    `Price book (JSON):`,
    JSON.stringify(priceBookForPrompt, null, 2),
    ...(input.instructions?.trim()
      ? [
          ``,
          `Contractor's standing quoting instructions:`,
          `"""${input.instructions.trim()}"""`,
        ]
      : []),
    ``,
    `Dictated job description:`,
    `"""${input.transcript}"""`,
  ].join("\n");

  return [
    ...(input.images ?? []).map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.media_type,
        data: img.data,
      },
    })),
    { type: "text" as const, text },
  ];
}

export async function generateQuote(input: {
  transcript: string;
  priceBook: PriceBookItem[];
  hourlyRate: number;
  trade: string;
  instructions?: string | null;
  images?: QuoteImage[];
}): Promise<QuoteDraftT> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: QUOTE_SYSTEM,
    messages: [{ role: "user", content: buildQuoteContent(input) }],
    output_config: { format: zodOutputFormat(QuoteDraft) },
  });

  if (!response.parsed_output) {
    throw new Error("Quote generation returned no structured output");
  }
  return response.parsed_output;
}

const TIER_RULES = `

Produce THREE versions of this quote — good, better, best:
- good: the leanest sound version of the dictated scope. Trim nice-to-haves, choose budget-appropriate materials, but never compromise safety or code.
- better: the job exactly as dictated — what you would actually recommend.
- best: premium materials, longevity upgrades, or genuinely fitting extras for THIS job. Do not pad with unrelated work.
All three stay grounded in the dictation and price book; tiers may share identical lines where the scope doesn't vary. Each tier gets a one-sentence tier_summary the customer will read.`;

export async function generateTieredQuote(input: {
  transcript: string;
  priceBook: PriceBookItem[];
  hourlyRate: number;
  trade: string;
  instructions?: string | null;
  images?: QuoteImage[];
}): Promise<TieredQuoteDraftT> {
  const response = await client.messages.parse({
    model: MODEL,
    // 16000 stays under the SDK's no-streaming ceiling (24000 trips
    // "Streaming is required for operations that may take longer than 10
    // minutes") and is ample for three compact line-item sets.
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: QUOTE_SYSTEM + TIER_RULES,
    messages: [{ role: "user", content: buildQuoteContent(input) }],
    output_config: { format: zodOutputFormat(TieredQuoteDraft) },
  });

  if (!response.parsed_output) {
    throw new Error("Tiered quote generation returned no structured output");
  }
  return response.parsed_output;
}

const EXTRACT_SYSTEM = `You are the onboarding engine inside QuoteMagic. A trade contractor is teaching the app their pricing by describing a few past jobs out loud — what the job was, what they did, and what they charged.

From these dictations, extract a reusable PRICE BOOK: generic, job-agnostic line items this contractor can bill again on future jobs.

Rules:
- Generalize: "installed a 50 amp breaker for the Hendersons, charged em 180" -> item "50A breaker install", unit each, unit_cost_estimate 180.
- Prefer per-unit items (each, foot, hour) over whole-job lump sums. If a total price covers several distinct tasks, split it sensibly using trade knowledge.
- Derive per-unit prices from what was actually said wherever possible; fill gaps with fair market estimates for this trade and mark lower confidence.
- est_minutes_per_unit is labor time per single unit.
- De-duplicate: one item per distinct kind of work.
- Categories should be short and reusable (e.g. Panel, Wiring, Devices, Service).`;

export async function extractPriceBook(input: {
  transcripts: string[];
  trade: string;
  hourlyRate: number;
}): Promise<ExtractedPriceBookT> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Trade: ${input.trade || "general contractor"}`,
          `Hourly labor rate: $${input.hourlyRate}/hr`,
          ``,
          ...input.transcripts.map(
            (t, i) => `Past job ${i + 1}:\n"""${t}"""\n`
          ),
        ].join("\n"),
      },
    ],
    output_config: { format: zodOutputFormat(ExtractedPriceBook) },
  });

  if (!response.parsed_output) {
    throw new Error("Price book extraction returned no structured output");
  }
  return response.parsed_output;
}
