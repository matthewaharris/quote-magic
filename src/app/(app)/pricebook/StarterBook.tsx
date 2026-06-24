"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { generateStarterPriceBook } from "./actions";

// Empty-state bootstrap: AI-generate a starter price book from the
// contractor's trade plus an optional one-line business description. Replaces
// the old hardcoded "demo electrician" seed so it works for any trade.
export default function StarterBook({ trade }: { trade: string }) {
  const router = useRouter();
  const toast = useToast();
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateStarterPriceBook(description);
      if (res.ok) {
        toast(res.message ?? "Starter price book added.");
        router.refresh();
      } else {
        setError(res.message ?? "Couldn't generate a starter price book.");
      }
    });
  }

  const tradeLabel = trade?.trim() || "your trade";

  return (
    <div className="mt-8 space-y-3 text-left">
      <p className="text-center text-zinc-500">Your price book is empty.</p>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">
          Tell us about your business{" "}
          <span className="font-normal text-zinc-400">(optional)</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          rows={3}
          placeholder={`e.g. I'm a ${tradeLabel} — mostly residential service calls, repairs, and small installs. I specialize in…`}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        />
        <span className="mt-1 block text-xs text-zinc-400">
          The more you share, the better the AI tailors your starter items. You
          can edit, add, or delete any of them afterward.
        </span>
      </label>

      <button
        onClick={generate}
        disabled={pending}
        className="block w-full rounded-xl bg-amber-600 px-5 py-3.5 font-semibold text-white disabled:opacity-50"
      >
        {pending
          ? "Building your starter price book…"
          : "✨ Generate a starter price book"}
      </button>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
