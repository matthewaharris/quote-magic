"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatMoney, type PriceBookItem } from "@/lib/types";
import {
  addPriceBookItem,
  deletePriceBookItem,
  updatePriceBookItem,
  type PriceBookInput,
} from "./actions";

const UNCATEGORIZED = "Uncategorized";
const NEW_SENTINEL = "__new__";
const COLLAPSE_KEY = "pricebook-collapsed-categories";

const EMPTY: PriceBookInput = {
  name: "",
  description: "",
  category: "",
  unit: "each",
  unit_cost: 0,
  est_minutes_per_unit: 30,
};

// Reuse an existing category's spelling if the typed name matches one
// case-insensitively, so "Wiring" and "wiring" don't fork into two buckets.
function normalizeCategory(
  input: string | null,
  categories: string[]
): string | null {
  const t = (input ?? "").trim();
  if (!t) return null;
  return categories.find((c) => c.toLowerCase() === t.toLowerCase()) ?? t;
}

function ItemForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
}: {
  initial: PriceBookInput;
  categories: string[];
  onSubmit: (values: PriceBookInput) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [values, setValues] = useState(initial);
  // "" = Uncategorized, a category name, or NEW_SENTINEL while typing a new one.
  const [selecting, setSelecting] = useState(initial.category?.trim() || "");
  const [newCat, setNewCat] = useState("");
  const set = (patch: Partial<PriceBookInput>) =>
    setValues((v) => ({ ...v, ...patch }));

  function submit() {
    const category =
      selecting === NEW_SENTINEL
        ? normalizeCategory(newCat, categories)
        : selecting || null;
    onSubmit({ ...values, category });
  }

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
      <div>
        <label className="text-xs text-zinc-500">
          Category <span className="text-zinc-400">— optional, groups items on this page</span>
        </label>
        <select
          value={selecting}
          onChange={(e) => setSelecting(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW_SENTINEL}>+ New category…</option>
        </select>
        {selecting === NEW_SENTINEL && (
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category name"
            autoFocus
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
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
          onChange={(e) => set({ est_minutes_per_unit: Number(e.target.value) })}
          placeholder="Min/unit"
          className="rounded-lg border border-zinc-300 px-2 py-2"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
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

export default function PriceBookManager({ items }: { items: PriceBookItem[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Persist collapse state so a long book stays the way the user left it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore unreadable/legacy storage
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed]));
    } catch {
      // storage may be unavailable (private mode); collapse just won't persist
    }
  }, [collapsed]);

  // Implicit categories: the distinct set of values already in use.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const c = i.category?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [items]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)
    );
  }, [items, q]);

  // Group by category, named groups alphabetical, Uncategorized pinned last.
  const groups = useMemo(() => {
    const map = new Map<string, PriceBookItem[]>();
    for (const i of filtered) {
      const key = i.category?.trim() || UNCATEGORIZED;
      (map.get(key) ?? map.set(key, []).get(key)!).push(i);
    }
    const named = [...map.keys()]
      .filter((k) => k !== UNCATEGORIZED)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const ordered = map.has(UNCATEGORIZED) ? [...named, UNCATEGORIZED] : named;
    return ordered.map((key) => ({ key, items: map.get(key)! }));
  }, [filtered]);

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

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const multiGroup = groups.length > 1;

  function renderRow(item: PriceBookItem) {
    if (editingId === item.id) {
      return (
        <ItemForm
          initial={{
            name: item.name,
            description: item.description,
            category: item.category,
            unit: item.unit,
            unit_cost: Number(item.unit_cost),
            est_minutes_per_unit: item.est_minutes_per_unit,
          }}
          categories={categories}
          busy={busy}
          submitLabel="Save"
          onSubmit={(v) => run(() => updatePriceBookItem(item.id, v))}
          onCancel={() => setEditingId(null)}
        />
      );
    }
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3">
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
            {item.source !== "manual" && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                {item.source}
              </span>
            )}
          </span>
          <span>
            ~{item.est_minutes_per_unit} min/{item.unit}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {adding ? (
        <ItemForm
          initial={EMPTY}
          categories={categories}
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

      <div className="mt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {multiGroup && !searching && (
        <div className="mt-2 flex justify-end gap-3 text-xs font-medium text-amber-700">
          <button onClick={() => setCollapsed(new Set())}>Expand all</button>
          <span className="text-zinc-300">·</span>
          <button onClick={() => setCollapsed(new Set(groups.map((g) => g.key)))}>
            Collapse all
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">
          No items match “{query.trim()}”.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((group) => {
            const open = searching || !collapsed.has(group.key);
            return (
              <section key={group.key}>
                <button
                  onClick={() => !searching && toggle(group.key)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left"
                  aria-expanded={open}
                >
                  <span
                    className={`text-zinc-400 transition-transform ${
                      open ? "rotate-90" : ""
                    }`}
                  >
                    ▸
                  </span>
                  <span className="text-sm font-semibold text-zinc-700">
                    {group.key}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                    {group.items.length}
                  </span>
                </button>
                {open && (
                  <ul className="mt-1 space-y-2">
                    {group.items.map((item) => (
                      <li key={item.id}>{renderRow(item)}</li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
