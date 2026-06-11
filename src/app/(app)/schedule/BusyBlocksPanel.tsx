"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BusyBlock } from "@/lib/types";
import { formatSlotRange } from "@/lib/scheduling";
import { addBusyBlock, deleteBusyBlock } from "./actions";

// Add/remove personal commitments that block the booking calendar.
// Upcoming blocks render in the merged agenda on the page itself; this
// panel is just the editor.
export default function BusyBlocksPanel({ blocks }: { blocks: BusyBlock[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      setError(null);
      const result = await addBusyBlock({ title, date, start, end });
      if (!result.ok) {
        setError(result.message ?? "Couldn't add that.");
        return;
      }
      setTitle("");
      setDate("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteBusyBlock(id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-semibold text-zinc-900">Block off time</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Existing appointments, personal time — customers can&apos;t book over
        these.
      </p>

      <div className="mt-3 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it? (e.g. Smith kitchen remodel)"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <label className="block">
            <span className="text-[10px] uppercase text-zinc-400">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase text-zinc-400">From</span>
            <input
              type="time"
              value={start}
              step={1800}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase text-zinc-400">To</span>
            <input
              type="time"
              value={end}
              step={1800}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
        </div>
        <button
          onClick={add}
          disabled={busy || !date}
          className="w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          {busy ? "Working…" : "+ Block this time"}
        </button>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>

      {blocks.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-zinc-800">{b.title}</p>
                <p className="text-xs text-zinc-500">
                  {formatSlotRange(b.start_at, b.end_at)}
                </p>
              </div>
              <button
                onClick={() => remove(b.id)}
                disabled={busy}
                className="text-xs text-zinc-400 underline underline-offset-2 hover:text-red-500"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
