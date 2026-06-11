"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type ChangeOrder } from "@/lib/types";
import { addChangeOrder } from "./actions";

const statusStyle: Record<ChangeOrder["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-700",
};

export default function ChangeOrdersPanel({
  quoteId,
  changeOrders,
  invoiced,
}: {
  quoteId: string;
  changeOrders: ChangeOrder[];
  invoiced: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await addChangeOrder(quoteId, {
      title,
      description,
      amount: Number(amount),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message ?? "Could not save");
      return;
    }
    setTitle("");
    setAmount("");
    setDescription("");
    setAdding(false);
    setMessage(result.emailed ? "Sent to the customer to approve." : "Added — share the quote link so they can approve.");
    router.refresh();
  }

  if (changeOrders.length === 0 && invoiced) return null;

  return (
    <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Change orders
      </h2>

      {changeOrders.length > 0 && (
        <ul className="mt-2 space-y-2">
          {changeOrders.map((co) => (
            <li
              key={co.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-zinc-50 p-2.5 text-sm"
            >
              <div>
                <p
                  className={`font-medium ${co.status === "declined" ? "text-zinc-400 line-through" : "text-zinc-900"}`}
                >
                  {co.title}
                </p>
                {co.description && (
                  <p className="text-xs text-zinc-500">{co.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-zinc-900">
                  {formatMoney(Number(co.amount))}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[co.status]}`}
                >
                  {co.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {invoiced ? (
        <p className="mt-2 text-xs text-zinc-400">
          Invoice issued — no further change orders.
        </p>
      ) : adding ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What changed? e.g. Add second GFCI outlet"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$ amount"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-500"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send for approval"}
            </button>
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional note for the customer"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm placeholder:text-zinc-500"
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700"
        >
          ➕ Add change order
        </button>
      )}

      {message && <p className="mt-2 text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
