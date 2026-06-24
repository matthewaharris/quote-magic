"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { submitFeedback } from "@/app/(app)/feedbackActions";
import type { FeedbackType } from "@/lib/types";

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "🐞 Bug" },
  { value: "feature", label: "💡 Idea" },
  { value: "other", label: "💬 Other" },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const toast = useToast();

  function close() {
    setOpen(false);
    setMessage("");
    setType("bug");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    const result = await submitFeedback({
      type,
      message,
      pageUrl: typeof window !== "undefined" ? window.location.pathname : "",
    });
    setSending(false);
    if (result.ok) {
      toast("Thanks — we got your feedback!");
      close();
    } else {
      toast(result.message ?? "Could not send", "error");
    }
  }

  return (
    <>
      {/* Floating launcher — sits above the bottom nav, below toasts. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="print-hide fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl text-white shadow-lg ring-1 ring-black/5 transition hover:bg-zinc-700"
      >
        💬
      </button>

      {open && (
        <div
          className="print-hide fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={close}
        >
          <form
            onSubmit={send}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Send feedback
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Report a bug or suggest something — we read every one.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    type === t.value
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={
                type === "bug"
                  ? "What went wrong? What were you trying to do?"
                  : type === "feature"
                    ? "What would make QuoteMagic better for you?"
                    : "Tell us anything…"
              }
              className="mt-3 w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send feedback"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
