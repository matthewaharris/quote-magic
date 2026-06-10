"use client";

import { useState, useTransition } from "react";
import { formatMoney, type PriceBookItem } from "@/lib/types";
import {
  addPriceBookItem,
  deletePriceBookItem,
  updatePriceBookItem,
  type PriceBookInput,
} from "./actions";

const EMPTY: PriceBookInput = {
  name: "",
  description: "",
  category: "",
  unit: "each",
  unit_cost: 0,
  est_minutes_per_unit: 30,
};

function ItemForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
}: {
  initial: PriceBookInput;
  onSubmit: (values: PriceBookInput) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<PriceBookInput>) =>
    setValues((v) => ({ ...v, ...patch }));

  return (
    <div className="space-y-2 rounded-xl border border-zinc-300 bg-white p-3">
      <input
        value={values.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder="Item name"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <input
        value={values.description ?? ""}
        onChange={(e) => set({ description: e.target.value })}
        placeholder="Description (shown to customers)"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-4 gap-2 text-sm">
        <input
          value={values.category ?? ""}
          onChange={(e) => set({ category: e.target.value })}
          placeholder="Category"
          className="rounded-lg border border-zinc-300 px-2 py-2"
        />
        <input
          value={values.unit}
          onChange={(e) => set({ unit: e.target.value })}
          placeholder="Unit"
          className="rounded-lg border border-zinc-300 px-2 py-2"
        />
        <input
          type="number"
          inputMode="decimal"
          value={values.unit_cost}
          onChange={(e) => set({ unit_cost: Number(e.target.value) })}
          placeholder="$/unit"
          className="rounded-lg border border-zinc-300 px-2 py-2"
        />
        <input
          type="number"
          inputMode="numeric"
          value={values.est_minutes_per_unit}
          onChange={(e) =>
            set({ est_minutes_per_unit: Number(e.target.value) })
          }
          placeholder="Min/unit"
          className="rounded-lg border border-zinc-300 px-2 py-2"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(values)}
          disabled={busy || !values.name.trim()}
          className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PriceBookManager({
  items,
}: {
  items: PriceBookItem[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setError(result.ok ? null : (result.message ?? "Something went wrong"));
      if (result.ok) {
        setAdding(false);
        setEditingId(null);
      }
    });
  }

  return (
    <div className="mt-4">
      {adding ? (
        <ItemForm
          initial={EMPTY}
          busy={busy}
          submitLabel="Add item"
          onSubmit={(v) => run(() => addPriceBookItem(v))}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500"
        >
          + Add item
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 space-y-2">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id}>
              <ItemForm
                initial={{
                  name: item.name,
                  description: item.description,
                  category: item.category,
                  unit: item.unit,
                  unit_cost: Number(item.unit_cost),
                  est_minutes_per_unit: item.est_minutes_per_unit,
                }}
                busy={busy}
                submitLabel="Save"
                onSubmit={(v) => run(() => updatePriceBookItem(item.id, v))}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setEditingId(item.id)}
                  className="truncate text-left font-medium text-zinc-900"
                >
                  {item.name}
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-700">
                    {formatMoney(Number(item.unit_cost))}/{item.unit}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.name}"?`))
                        run(() => deletePriceBookItem(item.id));
                    }}
                    className="text-zinc-300 hover:text-red-500"
                    aria-label={`Delete ${item.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="mt-0.5 flex justify-between text-xs text-zinc-500">
                <span>
                  {item.category}
                  {item.source !== "manual" && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      {item.source}
                    </span>
                  )}
                </span>
                <span>
                  ~{item.est_minutes_per_unit} min/{item.unit}
                </span>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
