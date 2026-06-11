"use client";

import { useState } from "react";
import ScheduleCalendar from "./ScheduleCalendar";

// Collapsed by default under the scheduled-appointment card; expanding it
// reopens the slot picker. Every offered slot is genuinely open on the
// contractor's calendar, so picking one rebooks directly.
export default function RescheduleSection({ token }: { token: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-sky-800 underline underline-offset-2"
      >
        Need a different time? Reschedule
      </button>
    );
  }

  return (
    <div className="mt-3 text-left">
      <ScheduleCalendar token={token} reschedule />
      <button
        onClick={() => setOpen(false)}
        className="mt-2 w-full text-center text-xs text-zinc-500 underline underline-offset-2"
      >
        Keep my current time
      </button>
    </div>
  );
}
