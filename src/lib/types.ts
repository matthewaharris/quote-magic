export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";
export type PriceBookSource = "seeded" | "learned" | "manual";

export interface Contractor {
  id: string;
  auth_user_id: string;
  business_name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  hourly_rate: number;
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

export interface Quote {
  id: string;
  contractor_id: string;
  customer_id: string | null;
  status: QuoteStatus;
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

export interface QuoteEvent {
  id: string;
  quote_id: string;
  type: "created" | "sent" | "viewed" | "accepted" | "declined" | "edited";
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
