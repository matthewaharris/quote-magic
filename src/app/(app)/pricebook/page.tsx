import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import type { PriceBookItem } from "@/lib/types";
import PriceBookManager from "./PriceBookManager";
import { seedDemoPriceBook } from "./actions";

export default async function PriceBookPage() {
  const { supabase, contractor } = await requireContractor();

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
        <div className="mt-8 space-y-3 text-center">
          <p className="text-zinc-500">Your price book is empty.</p>
          <Link
            href="/onboarding"
            className="block w-full rounded-xl bg-amber-600 px-5 py-3.5 font-semibold text-white"
          >
            🎙️ Teach the AI from past jobs
          </Link>
          <form
            action={async () => {
              "use server";
              await seedDemoPriceBook();
            }}
          >
            <button className="w-full rounded-xl border border-zinc-300 bg-white px-5 py-3 font-medium text-zinc-700">
              Or load the demo electrician price book
            </button>
          </form>
        </div>
      ) : (
        <PriceBookManager items={items} />
      )}
    </div>
  );
}
