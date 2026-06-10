import { z } from "zod";

// Output schema for quote generation from a job dictation.
export const QuoteLineItemDraft = z.object({
  matched_price_book_item_id: z
    .string()
    .nullable()
    .describe(
      "The id of the matched price book item, or null if this is a new item not in the price book"
    ),
  name: z.string().describe("Short line item name as it appears on the quote"),
  description: z
    .string()
    .describe("One-sentence description of the work for the customer"),
  qty: z.number().describe("Quantity in the given unit"),
  unit: z.string().describe("Unit, e.g. each, hour, foot"),
  unit_price: z
    .number()
    .describe(
      "Price per unit. Use the price book price when matched; best-guess market price when new."
    ),
  est_minutes: z
    .number()
    .describe("Estimated total labor minutes for this line (qty included)"),
  confidence: z
    .number()
    .describe("0 to 1 confidence that this line correctly reflects the dictation"),
  is_new_item: z
    .boolean()
    .describe("True when this work is not covered by any price book item"),
});

export const QuoteDraft = z.object({
  title: z.string().describe("Short job title, e.g. 'Sauna circuit installation'"),
  job_summary: z
    .string()
    .describe("2-3 sentence plain-language summary of the job for the customer"),
  line_items: z.array(QuoteLineItemDraft),
  assumptions: z
    .array(z.string())
    .describe("Assumptions made where the dictation was ambiguous"),
  questions_for_contractor: z
    .array(z.string())
    .describe("Things the contractor should confirm before sending"),
});

export type QuoteDraftT = z.infer<typeof QuoteDraft>;

// Output schema for onboarding: extract price book items from dictated past jobs.
export const ExtractedPriceBook = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Reusable, job-agnostic line item name"),
      description: z.string().describe("What this item covers"),
      category: z.string().describe("Short grouping, e.g. Panel, Wiring, Devices"),
      unit: z.string().describe("Billing unit: each, hour, foot, sqft, load"),
      unit_cost_estimate: z
        .number()
        .describe("Estimated customer price per unit based on what was dictated"),
      est_minutes_per_unit: z.number().describe("Estimated labor minutes per unit"),
      confidence: z.number().describe("0 to 1 confidence in the extracted pricing"),
    })
  ),
});

export type ExtractedPriceBookT = z.infer<typeof ExtractedPriceBook>;
