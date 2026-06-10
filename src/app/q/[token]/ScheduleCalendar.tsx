"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/types";
import { formatSlotTime } from "@/lib/scheduling";

interface DaySlots {
  date: string;
  label: string;
  slots: string[];
}

export default function ScheduleCalendar({ token }: { token: string }) {
  const router = useRouter();
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/q/${token}/slots`)
      .then((r) => r.json())
      .then((data) => {
        setDays(data.days ?? []);
        setDurationMinutes(data.durationMinutes ?? 0);
        const firstWithSlots = (data.days ?? []).findIndex(
          (d: DaySlots) => d.slots.length > 0
        );
        if (firstWithSlots >= 0) setActiveDay(firstWithSlots);
      })
      .catch(() => setError("Couldn't load available times."));
  }, [token]);

  async function book() {
    if (!selected) return;
    setBooking(true);
    setError(null);
    try {
      const res = await fetch(`/api/q/${token}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
      setBooking(false);
    }
  }

  if (error && !days) {
    return <p className="text-center text-sm text-red-600">{error}</p>;
  }
  if (!days) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Loading available times…
      </p>
    );
  }

  const day = days[activeDay];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h3 className="font-semibold text-zinc-900">Pick a time for the work</h3>
      <p className="mt-0.5 text-sm text-zinc-500">
        This job takes about {formatDuration(durationMinutes)}.
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => {
              setActiveDay(i);
              setSelected(null);
            }}
            disabled={d.slots.length === 0}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${
              i === activeDay
                ? "bg-zinc-900 text-white"
                : d.slots.length === 0
                  ? "bg-zinc-50 text-zinc-300"
                  : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {day.slots.length === 0 ? (
          <p className="col-span-3 py-2 text-center text-sm text-zinc-400">
            No openings this day
          </p>
        ) : (
          day.slots.map((iso) => (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              className={`rounded-xl border py-2.5 text-sm font-medium ${
                selected === iso
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-zinc-300 text-zinc-700"
              }`}
            >
              {formatSlotTime(iso)}
            </button>
          ))
        )}
      </div>

      <button
        onClick={book}
        disabled={!selected || booking}
        className="mt-4 w-full rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {booking
          ? "Booking…"
          : selected
            ? `Book ${day.label}, ${formatSlotTime(selected)}`
            : "Select a time"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
