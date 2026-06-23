"use client";

import { useState } from "react";
import { TRADES } from "@/lib/types";
import { updateProfile, refreshLogo } from "./actions";
import { lookupTax } from "../taxActions";

const inputClass =
  "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export default function SettingsForm({
  initial,
}: {
  initial: {
    name: string;
    business_name: string;
    phone: string;
    trade: string;
    hourly_rate: number;
    deposit_percent: number;
    default_markup_percent: number;
    default_tax_rate: number;
    business_zip: string;
    payment_instructions: string;
    website_url: string;
    logo_url: string | null;
  };
}) {
  const isKnownTrade = (t: string) =>
    (TRADES as readonly string[]).includes(t);

  const [name, setName] = useState(initial.name);
  const [businessName, setBusinessName] = useState(initial.business_name);
  const [phone, setPhone] = useState(initial.phone);
  const [trade, setTrade] = useState(initial.trade);
  // Custom-trade mode: a saved trade that isn't one of the presets puts the
  // dropdown into "Other" and reveals the free-text field.
  const [customTrade, setCustomTrade] = useState(
    initial.trade !== "" && !isKnownTrade(initial.trade)
  );
  const [hourlyRate, setHourlyRate] = useState(initial.hourly_rate);
  const [depositPercent, setDepositPercent] = useState(initial.deposit_percent);
  const [markupPercent, setMarkupPercent] = useState(
    initial.default_markup_percent
  );
  const [taxRate, setTaxRate] = useState(initial.default_tax_rate);
  const [businessZip, setBusinessZip] = useState(initial.business_zip);
  const [lookingUpTax, setLookingUpTax] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState(
    initial.payment_instructions
  );
  const [website, setWebsite] = useState(initial.website_url);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);

  const [saving, setSaving] = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({
      name,
      business_name: businessName,
      phone,
      trade,
      hourly_rate: hourlyRate,
      deposit_percent: depositPercent,
      default_markup_percent: markupPercent,
      default_tax_rate: taxRate,
      business_zip: businessZip,
      payment_instructions: paymentInstructions,
      website_url: website,
    });
    setSaving(false);
    setMessage(
      result.ok
        ? { kind: "ok", text: "Saved." }
        : { kind: "error", text: result.message ?? "Could not save" }
    );
  }

  async function findTaxRate() {
    setLookingUpTax(true);
    setMessage(null);
    const result = await lookupTax(businessZip);
    setLookingUpTax(false);
    if (result.ok) {
      setTaxRate(result.rate);
      setMessage({
        kind: "ok",
        text: `Sales tax${result.region ? ` for ${result.region}` : ""}: ${result.rate}% — save to keep it.`,
      });
    } else {
      setMessage({ kind: "error", text: result.message ?? "Lookup failed." });
    }
  }

  async function fetchLogo() {
    setFetchingLogo(true);
    setMessage(null);
    const result = await refreshLogo(website);
    setFetchingLogo(false);
    if (result.ok) {
      setLogoUrl(result.logoUrl ?? null);
      setMessage({ kind: "ok", text: "Logo updated from your website." });
    } else {
      setMessage({ kind: "error", text: result.message ?? "Couldn't fetch a logo." });
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <label className="block text-sm text-zinc-600">
        Your name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm text-zinc-600">
        Company name
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Shown on quotes & invoices"
          className={inputClass}
        />
      </label>
      <label className="block text-sm text-zinc-600">
        Phone
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Shown on quotes"
          className={inputClass}
        />
      </label>
      <label className="block text-sm text-zinc-600">
        Trade
        <select
          value={customTrade ? "__custom__" : trade}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setCustomTrade(true);
              setTrade("");
            } else {
              setCustomTrade(false);
              setTrade(e.target.value);
            }
          }}
          className={inputClass}
        >
          <option value="">Pick your trade</option>
          {TRADES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="__custom__">Other (type your own)…</option>
        </select>
        {customTrade && (
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            placeholder="e.g. tile setter, fence builder, pressure washing"
            className={inputClass}
            autoFocus
          />
        )}
      </label>
      <label className="block text-sm text-zinc-600">
        Hourly labor rate ($/hr)
        <input
          type="number"
          inputMode="decimal"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(Number(e.target.value))}
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm text-zinc-600">
          Markup (%)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={markupPercent}
            onChange={(e) => setMarkupPercent(Number(e.target.value))}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-zinc-400">
            Baked into every new quote&apos;s prices — customers never see it.
          </span>
        </label>
        <label className="block text-sm text-zinc-600">
          Sales tax (%)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={25}
            step={0.05}
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-zinc-400">
            Default tax on new quotes; editable per quote.
          </span>
        </label>
      </div>
      <label className="block text-sm text-zinc-600">
        Business zip code
        <div className="mt-1 flex gap-2">
          <input
            inputMode="numeric"
            maxLength={5}
            value={businessZip}
            onChange={(e) =>
              setBusinessZip(e.target.value.replace(/\D/g, "").slice(0, 5))
            }
            placeholder="e.g. 73101"
            className={`${inputClass} mt-0`}
          />
          <button
            type="button"
            onClick={findTaxRate}
            disabled={lookingUpTax || !/^[0-9]{5}$/.test(businessZip)}
            className="shrink-0 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            {lookingUpTax ? "Looking…" : "Find my tax rate"}
          </button>
        </div>
        <span className="mt-1 block text-xs text-zinc-400">
          Looks up your local sales tax and fills the field above.
        </span>
      </label>
      <label className="block text-sm text-zinc-600">
        Deposit on acceptance (%)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={depositPercent}
          onChange={(e) => setDepositPercent(Number(e.target.value))}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-zinc-400">
          Customers pay this up front when they accept a quote. 0 disables
          deposits.
        </span>
      </label>
      <label className="block text-sm text-zinc-600">
        How customers pay you
        <textarea
          value={paymentInstructions}
          onChange={(e) => setPaymentInstructions(e.target.value)}
          rows={3}
          placeholder={'e.g. "Zelle to 405-555-0123, or check payable to Smith Electric"'}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-zinc-400">
          Shown on invoices and deposit requests. You mark payments received
          from the quote page when the money lands.
        </span>
      </label>

      <div className="rounded-xl border border-zinc-200 bg-white p-3">
        <label className="block text-sm text-zinc-600">
          Website
          <input
            type="text"
            inputMode="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="yourcompany.com"
            className={inputClass}
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Your logo"
              className="h-12 max-w-32 rounded bg-zinc-50 object-contain"
            />
          ) : (
            <span className="text-xs text-zinc-400">No logo yet</span>
          )}
          <button
            type="button"
            onClick={fetchLogo}
            disabled={fetchingLogo || !website.trim()}
            className="ml-auto rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            {fetchingLogo ? "Fetching…" : logoUrl ? "Re-fetch logo" : "Fetch logo"}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>

      {message && (
        <p
          className={`text-sm ${
            message.kind === "ok" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
