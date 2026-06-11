"use client";

import { useState, useTransition } from "react";
import type { WeeklyAvailability } from "@/lib/scheduling";
import { saveAvailability } from "./actions";

const DAYS: { dow: string; label: string }[] = [
  { dow: "1", label: "Mon" },
  { dow: "2", label: "Tue" },
  { dow: "3", label: "Wed" },
  { dow: "4", label: "Thu" },
  { dow: "5", label: "Fri" },
  { dow: "6", label: "Sat" },
  { dow: "0", label: "Sun" },
];

interface DayState {
  open: boolean;
  start: string;
  end: string;
}

export default function AvailabilityForm({
  initial,
}: {
  initial: WeeklyAvailability;
}) {
  const [days, setDays] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(
      DAYS.map(({ dow }) => {
        const day = initial[dow];
        return [
          dow,
          day
            ? { open: true, start: day.start, end: day.end }
            : { open: false, start: "08:00", end: "17:00" },
        ];
      })
    )
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [saving, startSaving] = useTransition();

  function patch(dow: string, p: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [dow]: { ...prev[dow], ...p } }));
    setDirty(true);
    setMessage(null);
  }

  function save() {
    startSaving(async () => {
      const payload: WeeklyAvailability = {};
      for (const { dow } of DAYS) {
        const d = days[dow];
        payload[dow] = d.open ? { start: d.start, end: d.end } : null;
      }
      const result = await saveAvailability(payload);
      setMessage(
        result.ok
          ? { ok: true, text: "Working hours saved." }
          : { ok: false, text: result.message ?? "Save failed" }
      );
      if (result.ok) setDirty(false);
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-semibold text-zinc-900">Working hours</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Customers can only book jobs inside these hours.
      </p>

      <ul className="mt-3 space-y-2">
        {DAYS.map(({ dow, label }) => {
          const d = days[dow];
          return (
            <li key={dow} className="flex items-center gap-3 text-sm">
              <label className="flex w-16 items-center gap-2 font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => patch(dow, { open: e.target.checked })}
                  className="h-4 w-4 accent-zinc-900"
                />
                {label}
              </label>
              {d.open ? (
                <span className="flex items-center gap-2">
                  <input
                    type="time"
                    value={d.start}
                    step={1800}
                    onChange={(e) => patch(dow, { start: e.target.value })}
                    className="rounded-lg border border-zinc-300 px-2 py-1"
                  />
                  <span className="text-zinc-400">to</span>
                  <input
                    type="time"
                    value={d.end}
                    step={1800}
                    onChange={(e) => patch(dow, { end: e.target.value })}
                    className="rounded-lg border border-zinc-300 px-2 py-1"
                  />
                </span>
              ) : (
                <span className="text-zinc-400">Closed</span>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={save}
        disabled={saving || !dirty}
        className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : dirty ? "Save working hours" : "Saved"}
      </button>
      {message && (
        <p
          className={`mt-2 text-center text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
