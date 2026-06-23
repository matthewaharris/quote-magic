import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { capabilitiesFor } from "@/lib/plan";
import type { PriceBookItem } from "@/lib/types";
import PriceBookManager from "./PriceBookManager";
import StarterBook from "./StarterBook";

export default async function PriceBookPage() {
  const { supabase, contractor } = await requireContractor();
  const canBulkImport = capabilitiesFor(contractor).bulkImport;

  const { data } = await supabase
    .from("price_book_items")
    .select("*")
    .eq("contractor_id", contractor.id)
    .order("category")
    .order("name");

  const items = (data ?? []) as PriceBookItem[];

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Price Book</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The AI builds quotes from these items.
      </p>

      {items.length === 0 ? (
        <>
          <StarterBook trade={contractor.trade} />
          {canBulkImport ? (
            <Link
              href="/pricebook/import"
              className="mt-4 block text-center text-sm font-medium text-amber-700 underline"
            >
              🎙️ Or AI bulk import from your past jobs
            </Link>
          ) : (
            <Link
              href="/pricebook/import"
              className="mt-4 block text-center text-sm font-medium text-amber-700 underline"
            >
              🔒 AI bulk import from past jobs — Solo &amp; Pro
            </Link>
          )}
        </>
      ) : (
        <>
          <PriceBookManager items={items} />
          {canBulkImport ? (
            <Link
              href="/pricebook/import"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3.5 font-semibold text-white"
            >
              🎙️ AI bulk import from past jobs
            </Link>
          ) : (
            <Link
              href="/pricebook/import"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 font-semibold text-amber-800"
            >
              🔒 AI bulk import — Solo &amp; Pro
            </Link>
          )}
        </>
      )}
    </div>
  );
}
