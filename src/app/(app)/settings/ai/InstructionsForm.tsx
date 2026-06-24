"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { saveQuotingInstructions } from "../actions";

export default function InstructionsForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await saveQuotingInstructions(value);
    setSaving(false);
    if (result.ok) toast("Saved — applies to your next quote.");
    else toast(result.message ?? "Could not save", "error");
  }

  return (
    <form onSubmit={save} className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Your quoting instructions
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Standing rules in your own words, applied to every quote you
        generate. Your price book prices always win.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        maxLength={2000}
        placeholder={
          "e.g.\nMinimum service call is $150.\nAlways add a permit line for panel work.\nI work with a helper — cut labor time by a third.\nAdd 1 hour travel time for jobs outside the metro."
        }
        className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <button
        type="submit"
        disabled={saving}
        className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save instructions"}
      </button>
    </form>
  );
}
