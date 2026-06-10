import { requireContractor } from "@/lib/contractor";
import { formatMoney, type PriceBookItem } from "@/lib/types";
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
        <div className="mt-10 text-center">
          <p className="text-zinc-500">Your price book is empty.</p>
          <form
            action={async () => {
              "use server";
              await seedDemoPriceBook();
            }}
          >
            <button className="mt-4 rounded-xl bg-zinc-900 px-5 py-3 font-semibold text-white">
              Load demo electrician price book
            </button>
          </form>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{item.name}</span>
                <span className="shrink-0 text-sm font-semibold text-zinc-700">
                  {formatMoney(item.unit_cost)}/{item.unit}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between text-xs text-zinc-500">
                <span>{item.category}</span>
                <span>~{item.est_minutes_per_unit} min/{item.unit}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
