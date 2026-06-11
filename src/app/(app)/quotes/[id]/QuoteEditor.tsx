"use client";

import { useMemo, useState, useTransition } from "react";
import {
  formatDuration,
  formatMoney,
  type ChangeOrder,
  type Invoice,
  type Job,
  type Quote,
  type QuoteLineItem,
} from "@/lib/types";
import { addLineToPriceBook, saveQuote, type EditableLine } from "./actions";
import ChangeOrdersPanel from "./ChangeOrdersPanel";
import JobPanel from "./JobPanel";
import SendPanel from "./SendPanel";

type Line = EditableLine & { _key: string; _savedToPb?: boolean };

function toEditable(items: QuoteLineItem[]): Line[] {
  return items.map((li) => ({
    _key: li.id,
    id: li.id,
    price_book_item_id: li.price_book_item_id,
    name: li.name,
    description: li.description,
    qty: Number(li.qty),
    unit: li.unit,
    unit_price: Number(li.unit_price),
    est_minutes: li.est_minutes,
    ai_confidence: li.ai_confidence === null ? null : Number(li.ai_confidence),
    is_new_item: li.is_new_item,
  }));
}

export default function QuoteEditor({
  quote,
  initialLines,
  job,
  invoice,
  changeOrders = [],
  sendShareToken,
}: {
  quote: Quote;
  initialLines: QuoteLineItem[];
  job?: Job | null;
  invoice?: Invoice | null;
  changeOrders?: ChangeOrder[];
  sendShareToken?: string;
}) {
  const [title, setTitle] = useState(quote.title);
  const [taxRate, setTaxRate] = useState(Number(quote.tax_rate));
  // Hours on the booking calendar; blank = auto from labor hours.
  const [durationHours, setDurationHours] = useState(
    quote.duration_override_minutes
      ? String(quote.duration_override_minutes / 60)
      : ""
  );
  const [lines, setLines] = useState<Line[]>(() => toEditable(initialLines));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const subtotal = useMemo(
    () =>
      Math.round(
        lines.reduce((s, l) => s + (l.qty || 0) * (l.unit_price || 0), 0) * 100
      ) / 100,
    [lines]
  );
  const total = Math.round(subtotal * (1 + (taxRate || 0) / 100) * 100) / 100;
  const totalMinutes = lines.reduce((s, l) => s + (l.est_minutes || 0), 0);

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, ...patch } : l))
    );
    setDirty(true);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l._key !== key));
    setDirty(true);
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        _key: `new-${Date.now()}`,
        price_book_item_id: null,
        name: "",
        description: null,
        qty: 1,
        unit: "each",
        unit_price: 0,
        est_minutes: 0,
        ai_confidence: null,
        is_new_item: false,
      },
    ]);
    setDirty(true);
  }

  // One-shot whole-quote markup: scales every line's unit price. Baked into
  // the prices the customer sees — there is no separate markup row.
  const [markupInput, setMarkupInput] = useState("");
  function applyMarkup() {
    const pct = Number(markupInput);
    if (!pct || pct <= -100) return;
    const factor = 1 + pct / 100;
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        unit_price: Math.round((l.unit_price || 0) * factor * 100) / 100,
      }))
    );
    setMarkupInput("");
    setDirty(true);
  }

  function save() {
    startSaving(async () => {
      const result = await saveQuote(quote.id, {
        title,
        tax_rate: taxRate,
        duration_override_minutes: Number(durationHours)
          ? Math.round(Number(durationHours) * 60)
          : null,
        lines: lines.map(({ _key, _savedToPb, ...l }) => l),
      });
      setMessage(result.ok ? "Saved." : (result.message ?? "Save failed"));
      if (result.ok) setDirty(false);
      setTimeout(() => setMessage(null), 2500);
    });
  }

  async function saveToPriceBook(line: Line) {
    const result = await addLineToPriceBook({
      name: line.name,
      description: line.description,
      unit: line.unit,
      unit_price: line.unit_price,
      est_minutes: line.est_minutes,
      qty: line.qty,
    });
    if (result.ok) {
      patchLine(line._key, {
        price_book_item_id: result.priceBookItemId,
        is_new_item: false,
        _savedToPb: true,
      });
      setMessage("Added to your price book — future quotes will match it.");
      setTimeout(() => setMessage(null), 3000);
    }
  }

  const newItems = lines.filter((l) => l.is_new_item);

  return (
    <div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="w-full rounded-lg border border-transparent bg-transparent text-xl font-bold text-zinc-900 outline-none focus:border-zinc-300 focus:bg-white"
      />
      <p className="mt-1 text-sm capitalize text-zinc-500">
        Status: {quote.status}
      </p>

      {quote.job_summary && (
        <p className="mt-3 rounded-xl bg-white p-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
          {quote.job_summary}
        </p>
      )}

      {newItems.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">
            {newItems.length} item{newItems.length > 1 ? "s" : ""} not in your
            price book
          </span>{" "}
          — AI guessed the price. Review below (highlighted), adjust, and
          optionally save them for next time.
        </div>
      )}

      {quote.questions.length > 0 && (
        <details className="mt-3 rounded-xl bg-white p-3 text-sm ring-1 ring-zinc-200">
          <summary className="cursor-pointer font-medium text-zinc-700">
            Things to confirm ({quote.questions.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
            {quote.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </details>
      )}

      <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Line items
      </h2>
      <ul className="mt-2 space-y-3">
        {lines.map((line) => (
          <li
            key={line._key}
            className={`rounded-xl border bg-white p-3 ${
              line.is_new_item ? "border-amber-400" : "border-zinc-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <input
                value={line.name}
                placeholder="Item name"
                onChange={(e) => patchLine(line._key, { name: e.target.value })}
                className="w-full rounded border border-transparent bg-transparent font-medium text-zinc-900 outline-none focus:border-zinc-300"
              />
              <button
                onClick={() => removeLine(line._key)}
                className="shrink-0 text-zinc-400 hover:text-red-500"
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
            {line.description && (
              <p className="mt-0.5 text-xs text-zinc-500">{line.description}</p>
            )}

            <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
              <label className="block">
                <span className="text-[10px] uppercase text-zinc-400">Qty</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={line.qty}
                  onChange={(e) =>
                    patchLine(line._key, { qty: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase text-zinc-400">Unit</span>
                <input
                  value={line.unit}
                  onChange={(e) =>
                    patchLine(line._key, { unit: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase text-zinc-400">
                  $/unit
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={line.unit_price}
                  onChange={(e) =>
                    patchLine(line._key, { unit_price: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                />
              </label>
              <div className="flex flex-col justify-end text-right">
                <span className="text-[10px] uppercase text-zinc-400">
                  Total
                </span>
                <span className="py-1.5 font-semibold">
                  {formatMoney((line.qty || 0) * (line.unit_price || 0))}
                </span>
              </div>
            </div>

            {line.is_new_item && (
              <div className="mt-2 flex items-center justify-between">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  ⚠ New item — AI-estimated price
                </span>
                <button
                  onClick={() => saveToPriceBook(line)}
                  disabled={!line.name.trim()}
                  className="text-xs font-medium text-amber-700 underline disabled:opacity-40"
                >
                  Save to price book
                </button>
              </div>
            )}
            {line._savedToPb && (
              <p className="mt-2 text-xs text-emerald-700">
                ✓ Saved to price book
              </p>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={addLine}
        className="mt-3 w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500"
      >
        + Add line item
      </button>

      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="flex justify-between text-sm text-zinc-600">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-zinc-600">
          <span>
            Markup all prices{" "}
            <input
              type="number"
              inputMode="decimal"
              value={markupInput}
              onChange={(e) => setMarkupInput(e.target.value)}
              placeholder="0"
              className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right text-xs placeholder:text-zinc-400"
            />
            %
          </span>
          <button
            type="button"
            onClick={applyMarkup}
            disabled={!Number(markupInput)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-zinc-600">
          <span>
            Tax{" "}
            <input
              type="number"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => {
                setTaxRate(Number(e.target.value));
                setDirty(true);
              }}
              className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right text-xs"
            />
            %
          </span>
          <span>{formatMoney(total - subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-zinc-100 pt-2 text-base font-bold text-zinc-900">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
        <p className="mt-1 text-right text-xs text-zinc-400">
          Est. labor: {formatDuration(totalMinutes)}
        </p>
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm text-zinc-600">
          <span>
            Time on calendar{" "}
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={durationHours}
              onChange={(e) => {
                setDurationHours(e.target.value);
                setDirty(true);
              }}
              placeholder={String(
                Math.max(1, Math.ceil((totalMinutes || 60) / 60))
              )}
              className="w-14 rounded border border-zinc-300 px-1 py-0.5 text-right text-xs placeholder:text-zinc-400"
            />{" "}
            hrs
          </span>
          <span className="text-xs text-zinc-400">
            {Number(durationHours)
              ? "custom — add buffer/drive time here"
              : "auto from labor hours"}
          </span>
        </div>
      </div>

      <div className="sticky bottom-20 mt-4">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="w-full rounded-xl bg-zinc-900 py-3.5 font-semibold text-white shadow-lg disabled:opacity-40"
        >
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        {message && (
          <p className="mt-2 text-center text-sm text-zinc-600">{message}</p>
        )}
      </div>

      {job && (
        <>
          <JobPanel
            job={job}
            invoice={invoice ?? null}
            shareToken={quote.share_token}
          />
          <ChangeOrdersPanel
            quoteId={quote.id}
            changeOrders={changeOrders}
            invoiced={!!invoice}
          />
        </>
      )}
      {!job && <SendPanel quote={quote} shareToken={sendShareToken} />}
    </div>
  );
}
