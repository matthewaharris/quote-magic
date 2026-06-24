"use client";

import { useState } from "react";
import { markChangelogSeen } from "@/app/(app)/changelogActions";
import type { ChangelogEntry } from "@/lib/types";

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WhatsNew({
  entries,
  seenAt,
}: {
  entries: ChangelogEntry[];
  seenAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Local override so the dot clears immediately on open without a reload.
  const [seen, setSeen] = useState(false);

  if (entries.length === 0) return null;

  const latest = entries[0].published_at;
  const hasUnseen =
    !seen && !!latest && (!seenAt || new Date(latest) > new Date(seenAt));

  function openPanel() {
    setOpen(true);
    if (hasUnseen) {
      setSeen(true);
      void markChangelogSeen();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="What's new"
        className="relative text-base leading-none"
        title="What's new"
      >
        🔔
        {hasUnseen && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div
          className="print-hide fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">What&apos;s new</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {entries.map((e) => (
                <div key={e.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-zinc-900">{e.title}</h3>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {fmt(e.published_at)}
                    </span>
                  </div>
                  {e.version && (
                    <p className="text-xs font-medium text-amber-700">
                      {e.version}
                    </p>
                  )}
                  {e.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">
                      {e.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
