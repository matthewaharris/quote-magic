import type { Contractor } from "@/lib/types";

// What each plan level can do. One source of truth for feature gating across
// the app — UI hides/upsells and server actions enforce off the same map.
//
// Levels: basic < solo < pro. Trial and comp get the full (pro) experience so
// people taste everything before they pick a paid tier; paid accounts get
// exactly their tier; a paid account with no tier (admin-set by hand) is
// treated as pro so our own bookkeeping never strips a paying customer.
export interface Capabilities {
  whiteLabel: boolean; // show the contractor's logo, drop the "Powered by" badge
  bulkImport: boolean; // AI dictate-past-jobs price book import
  aiCustomerMessage: boolean; // Solo+: AI-drafted message that accompanies a quote
  aiFollowup: boolean; // Solo+: AI-personalized nudge copy
  aiWinBack: boolean; // Pro: tailored reply / leaner re-quote on a decline
  aiInsights: boolean; // Pro: narrated analytics
  photoMeasure: boolean; // Pro: estimate quantities from job photos
  jobTemplates: boolean; // Pro: one-tap quote starts from learned recurring jobs
}

export type PlanLevel = "basic" | "solo" | "pro";

const CAPS: Record<PlanLevel, Capabilities> = {
  basic: {
    whiteLabel: false,
    bulkImport: false,
    aiCustomerMessage: false,
    aiFollowup: false,
    aiWinBack: false,
    aiInsights: false,
    photoMeasure: false,
    jobTemplates: false,
  },
  solo: {
    whiteLabel: true,
    bulkImport: true,
    aiCustomerMessage: true,
    aiFollowup: true,
    aiWinBack: false,
    aiInsights: false,
    photoMeasure: false,
    jobTemplates: false,
  },
  pro: {
    whiteLabel: true,
    bulkImport: true,
    aiCustomerMessage: true,
    aiFollowup: true,
    aiWinBack: true,
    aiInsights: true,
    photoMeasure: true,
    jobTemplates: true,
  },
};

export function planLevel(
  contractor: Pick<Contractor, "plan" | "plan_tier">
): PlanLevel {
  if (contractor.plan === "comp" || contractor.plan === "trial") return "pro";
  if (contractor.plan === "paid") return contractor.plan_tier ?? "pro";
  return "basic"; // disabled / unknown — most restricted (also blocked elsewhere)
}

export function capabilitiesFor(
  contractor: Pick<Contractor, "plan" | "plan_tier">
): Capabilities {
  return CAPS[planLevel(contractor)];
}
