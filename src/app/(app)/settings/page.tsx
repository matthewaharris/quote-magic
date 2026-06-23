import { requireContractor } from "@/lib/contractor";
import { createAdminClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";

const sectionHeader =
  "mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400";
const tileClass =
  "block rounded-xl border border-zinc-300 bg-white px-3 py-3 text-center text-sm font-medium text-zinc-700";

export default async function SettingsPage() {
  const { contractor } = await requireContractor();

  // Cross-tenant count (how many contractors I referred) needs the
  // service-role client; RLS hides other rows from the user client.
  const { count: referredCount } = await createAdminClient()
    .from("contractors")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", contractor.id);
  const referralUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://quotemagic.app"}/?ref=${contractor.id}`;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        What customers see on your quotes and invoices.
      </p>
      <div className="mt-4 space-y-4">
        <section>
          <h2 className={sectionHeader}>Invoicing</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href="/api/export/invoices.csv" className={tileClass}>
              ⬇️ Invoices CSV
            </a>
            <a href="/settings/qr" className={tileClass}>
              📇 QR truck card
            </a>
          </div>
        </section>

        <section>
          <h2 className={sectionHeader}>Scheduling</h2>
          <a href="/schedule" className={tileClass}>
            📅 Working hours & blocked time
          </a>
        </section>

        <section>
          <h2 className={sectionHeader}>Quoting & insights</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href="/settings/ai" className={tileClass}>
              ✨ How the AI quotes
            </a>
            <a href="/insights" className={tileClass}>
              📊 Insights — win rate & a tip
            </a>
          </div>
        </section>

        <section>
          <h2 className={sectionHeader}>Account & help</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href="/settings/billing" className={tileClass}>
              💳 Plan & billing
            </a>
            <a href="/support" className={tileClass}>
              💬 Help & support
            </a>
          </div>
        </section>
      </div>
      <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
        <p className="font-medium text-zinc-700">
          Your referral link{" "}
          <span className="font-normal text-zinc-400">
            · {referredCount ?? 0} referred · +10 trial quotes per signup
          </span>
        </p>
        <p className="mt-1 break-all text-xs text-zinc-500">{referralUrl}</p>
      </div>
      <SettingsForm
        initial={{
          name: contractor.name,
          business_name: contractor.business_name,
          phone: contractor.phone ?? "",
          trade: contractor.trade,
          hourly_rate: Number(contractor.hourly_rate),
          deposit_percent: Number(contractor.deposit_percent),
          default_markup_percent: Number(contractor.default_markup_percent),
          default_tax_rate: Number(contractor.default_tax_rate),
          business_zip: contractor.business_zip ?? "",
          payment_instructions: contractor.payment_instructions ?? "",
          website_url: contractor.website_url ?? "",
          logo_url: contractor.logo_url,
        }}
      />
    </div>
  );
}
