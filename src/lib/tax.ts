// Combined state+local sales tax rate (in PERCENT, e.g. 8.25) for a US zip,
// via the zip.tax API (free tier: 100 calls/month) behind the shared
// tax_rates cache table — cache hits cost nothing, so repeat zips across all
// contractors never touch the quota. Tax districts don't align perfectly
// with zips, so this is a seed for an always-editable field, not gospel.
// Never throws; without ZIPTAX_API_KEY it stubs in dev and fails politely
// in production (same convention as src/lib/email.ts).
import { createAdminClient } from "@/lib/supabase/server";

const CACHE_TTL_DAYS = 90; // local rates change at most quarterly
const API_TIMEOUT_MS = 6000;

export type TaxLookupResult =
  | { ok: true; rate: number; region: string | null; source: "cache" | "api" | "stub" }
  | { ok: false; reason: string };

export function isValidZip(zip: string): boolean {
  return /^[0-9]{5}$/.test(zip);
}

export async function lookupTaxRate(zipInput: string): Promise<TaxLookupResult> {
  const zip = zipInput.trim();
  if (!isValidZip(zip)) {
    return { ok: false, reason: "Enter a 5-digit US zip code." };
  }

  const admin = createAdminClient();
  const { data: cached } = await admin
    .from("tax_rates")
    .select("rate, region, fetched_at")
    .eq("zip", zip)
    .maybeSingle();
  const fresh =
    cached &&
    Date.now() - new Date(cached.fetched_at).getTime() <
      CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (cached && fresh) {
    return {
      ok: true,
      rate: Number(cached.rate),
      region: cached.region,
      source: "cache",
    };
  }

  const apiKey = process.env.ZIPTAX_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[tax stub] zip=${zip} -> 8.25% (set ZIPTAX_API_KEY)`);
      return { ok: true, rate: 8.25, region: "Stubville, OK", source: "stub" };
    }
    return { ok: false, reason: "Tax lookup isn't set up yet." };
  }

  try {
    const res = await fetch(
      `https://api.zip-tax.com/request/v60?postalcode=${zip}`,
      {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );
    if (!res.ok) throw new Error(`zip.tax HTTP ${res.status}`);
    const body = (await res.json()) as {
      rCode?: number;
      results?: {
        taxSales?: number; // decimal fraction, e.g. 0.0775
        geoCity?: string;
        geoState?: string;
      }[];
    };
    // rCode 100 = success; anything else (invalid zip, bad key, over quota)
    // has no usable rate.
    const top = body.rCode === 100 ? body.results?.[0] : undefined;
    if (!top || typeof top.taxSales !== "number") {
      return { ok: false, reason: "No tax rate found for that zip." };
    }
    const rate = Math.min(
      25,
      Math.max(0, Math.round(top.taxSales * 100 * 1000) / 1000)
    );
    const region =
      top.geoCity && top.geoState ? `${title(top.geoCity)}, ${top.geoState}` : null;
    await admin.from("tax_rates").upsert({
      zip,
      rate,
      region,
      fetched_at: new Date().toISOString(),
    });
    return { ok: true, rate, region, source: "api" };
  } catch (err) {
    console.error("tax lookup failed:", err);
    // A stale cached rate beats no rate — rates rarely move much.
    if (cached) {
      return {
        ok: true,
        rate: Number(cached.rate),
        region: cached.region,
        source: "cache",
      };
    }
    return { ok: false, reason: "Couldn't reach the tax rate service. Try again." };
  }
}

// zip.tax returns city names ALL-CAPS ("IRVINE") — make them display-ready.
function title(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
