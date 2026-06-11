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
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href="/api/export/invoices.csv"
          className="block rounded-xl border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700"
        >
          ⬇️ Invoices CSV
        </a>
        <a
          href="/settings/qr"
          className="block rounded-xl border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700"
        >
          📇 QR truck card
        </a>
      </div>
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
