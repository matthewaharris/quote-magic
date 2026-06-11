export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";
export type PriceBookSource = "seeded" | "learned" | "manual";

export const TRADES = [
  "electrician",
  "plumber",
  "handyman",
  "landscaper",
  "hauling",
  "hvac",
  "painter",
  "general contractor",
] as const;

export type ContractorPlan = "trial" | "comp" | "paid" | "disabled";

export interface Contractor {
  id: string;
  auth_user_id: string;
  name: string;
  business_name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  hourly_rate: number;
  logo_url: string | null;
  website_url: string | null;
  plan: ContractorPlan;
  trial_ends_at: string;
  trial_quote_limit: number;
  is_admin: boolean;
  deposit_percent: number;
  referred_by: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export interface PriceBookItem {
  id: string;
  contractor_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_cost: number;
  default_qty: number;
  est_minutes_per_unit: number;
  source: PriceBookSource;
  created_at: string;
}

export interface Customer {
  id: string;
  contractor_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export type QuoteTier = "good" | "better" | "best";

export interface Quote {
  id: string;
  contractor_id: string;
  customer_id: string | null;
  status: QuoteStatus;
  tier_group_id: string | null;
  tier: QuoteTier | null;
  title: string;
  job_summary: string | null;
  dictation_transcript: string | null;
  share_token: string;
  subtotal: number;
  tax_rate: number;
  total: number;
  est_total_minutes: number;
  assumptions: string[];
  questions: string[];
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  price_book_item_id: string | null;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  est_minutes: number;
  ai_confidence: number | null;
  is_new_item: boolean;
  sort_order: number;
}

export type JobStatus =
  | "unscheduled"
  | "scheduled"
  | "done_reported"
  | "confirmed"
  | "invoiced"
  | "paid";

export interface Job {
  id: string;
  quote_id: string;
  contractor_id: string;
  status: JobStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  deposit_amount: number;
  deposit_paid_at: string | null;
  deposit_ref: string | null;
  done_reported_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface ChangeOrder {
  id: string;
  quote_id: string;
  job_id: string;
  contractor_id: string;
  title: string;
  description: string | null;
  amount: number;
  status: "pending" | "approved" | "declined";
  created_at: string;
  responded_at: string | null;
}

export interface Invoice {
  id: string;
  job_id: string;
  quote_id: string;
  number: string;
  subtotal: number;
  tax_rate: number;
  total: number;
  status: "due" | "paid";
  deposit_applied: number;
  change_orders_total: number;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  payment_ref: string | null;
}

// Display label/color for a quote, preferring job stage once one exists.
export function stageBadge(
  quoteStatus: QuoteStatus,
  jobStatus?: JobStatus | null
): { label: string; className: string } {
  if (jobStatus && jobStatus !== "unscheduled") {
    const map: Record<JobStatus, { label: string; className: string }> = {
      unscheduled: { label: "accepted", className: "bg-emerald-100 text-emerald-700" },
      scheduled: { label: "scheduled", className: "bg-sky-100 text-sky-700" },
      done_reported: { label: "awaiting OK", className: "bg-amber-100 text-amber-700" },
      confirmed: { label: "confirmed", className: "bg-emerald-100 text-emerald-700" },
      invoiced: { label: "invoiced", className: "bg-indigo-100 text-indigo-700" },
      paid: { label: "paid", className: "bg-emerald-200 text-emerald-900" },
    };
    return map[jobStatus];
  }
  const map: Record<QuoteStatus, { label: string; className: string }> = {
    draft: { label: "draft", className: "bg-zinc-100 text-zinc-700" },
    sent: { label: "sent", className: "bg-blue-100 text-blue-700" },
    viewed: { label: "viewed", className: "bg-violet-100 text-violet-700" },
    accepted: { label: "accepted", className: "bg-emerald-100 text-emerald-700" },
    declined: { label: "declined", className: "bg-red-100 text-red-700" },
  };
  return map[quoteStatus];
}

export interface QuoteEvent {
  id: string;
  quote_id: string;
  type:
    | "created"
    | "sent"
    | "viewed"
    | "accepted"
    | "declined"
    | "edited"
    | "scheduled"
    | "done_reported"
    | "confirmed"
    | "invoiced"
    | "paid"
    | "deposit_paid"
    | "nudged"
    | "change_order_added"
    | "change_order_approved"
    | "change_order_declined";
  meta: Record<string, unknown>;
  created_at: string;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
