"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// DEMO checkout — clearly labeled, accepts anything, charges nothing.
export default function PayInvoice({
  token,
  total,
}: {
  token: string;
  total: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPaying(true);
    setError(null);
    // Simulated processing delay for demo feel.
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(`/api/q/${token}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setPaying(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-zinc-900 py-4 text-lg font-bold text-white shadow"
      >
        Pay {total}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">Card payment</h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Demo — no real charge
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          value={card}
          onChange={(e) => setCard(e.target.value)}
          placeholder="Card number"
          className="w-full rounded-xl border border-zinc-300 px-3 py-3"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            autoComplete="off"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            placeholder="MM/YY"
            className="rounded-xl border border-zinc-300 px-3 py-3"
          />
          <input
            inputMode="numeric"
            autoComplete="off"
            value={cvc}
            onChange={(e) => setCvc(e.target.value)}
            placeholder="CVC"
            className="rounded-xl border border-zinc-300 px-3 py-3"
          />
        </div>
      </div>
      <button
        onClick={pay}
        disabled={paying || !card || !exp || !cvc}
        className="mt-3 w-full rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {paying ? "Processing…" : `Pay ${total}`}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
