import Link from "next/link";
import { requireContractor } from "@/lib/contractor";
import { capabilitiesFor } from "@/lib/plan";
import ImportWizard from "./ImportWizard";

export default async function PriceBookImportPage() {
  const { contractor } = await requireContractor();

  // AI dictate-past-jobs import is a Solo+ perk. Basic still builds its price
  // book by hand (add items directly, or let quotes teach it as you go).
  if (!capabilitiesFor(contractor).bulkImport) {
    return (
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Import your prices</h1>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 text-center">
          <p className="text-2xl">✨</p>
          <p className="mt-2 font-semibold text-zinc-900">
            AI import is a Solo &amp; Pro feature
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            On Basic you can still build a full price book — add items directly,
            and every quote you send teaches the AI new ones automatically.
          </p>
          <Link
            href="/settings/billing"
            className="mt-4 inline-block rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            See plans
          </Link>
          <Link
            href="/pricebook"
            className="mt-3 block text-sm font-medium text-amber-700 underline"
          >
            ← Back to price book
          </Link>
        </div>
      </div>
    );
  }

  return <ImportWizard />;
}
