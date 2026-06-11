import { requireContractor } from "@/lib/contractor";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const { contractor } = await requireContractor();

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        What customers see on your quotes and invoices.
      </p>
      <a
        href="/api/export/invoices.csv"
        className="mt-4 block rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-700"
      >
        ⬇️ Export invoices (CSV for QuickBooks)
      </a>
      <SettingsForm
        initial={{
          name: contractor.name,
          business_name: contractor.business_name,
          phone: contractor.phone ?? "",
          trade: contractor.trade,
          hourly_rate: Number(contractor.hourly_rate),
          deposit_percent: Number(contractor.deposit_percent),
          website_url: contractor.website_url ?? "",
          logo_url: contractor.logo_url,
        }}
      />
    </div>
  );
}
