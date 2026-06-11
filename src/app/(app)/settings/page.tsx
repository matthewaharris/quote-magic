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
      <SettingsForm
        initial={{
          name: contractor.name,
          business_name: contractor.business_name,
          phone: contractor.phone ?? "",
          trade: contractor.trade,
          hourly_rate: Number(contractor.hourly_rate),
          website_url: contractor.website_url ?? "",
          logo_url: contractor.logo_url,
        }}
      />
    </div>
  );
}
