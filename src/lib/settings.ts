import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/trial";

// Global app settings live in the service-role-only app_settings table
// (migration 0013). These helpers use the admin client; never expose them to
// user-scoped paths that shouldn't write settings.

// Trial length (days) applied to NEW signups, and shown in marketing copy so
// the advertised number always matches reality. Memoized per request (cache)
// so multiple readers in one render share a single query. Falls back to the
// TRIAL_DAYS constant if the row is missing or the read fails.
export const getTrialDays = cache(async (): Promise<number> => {
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("trial_days")
      .eq("id", 1)
      .maybeSingle();
    const n = data?.trial_days;
    return typeof n === "number" && n >= 1 ? n : TRIAL_DAYS;
  } catch {
    return TRIAL_DAYS;
  }
});
