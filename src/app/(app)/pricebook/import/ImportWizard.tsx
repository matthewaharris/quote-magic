"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dictation from "@/components/Dictation";
import { saveImportedPriceBook, type ReviewedItem } from "./actions";

type Step = "dictate" | "review";

export default function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("dictate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One transcript per past job
  const [transcripts, setTranscripts] = useState<string[]>([""]);
  const [activeJob, setActiveJob] = useState(0);

  const [items, setItems] = useState<ReviewedItem[]>([]);

  async function extract() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/extract-pricebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcripts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setItems(
        data.items.map(
          (i: ReviewedItem & { unit_cost_estimate: number }) => ({
            name: i.name,
            description: i.description,
            category: i.category,
            unit: i.unit,
            unit_cost: i.unit_cost_estimate,
            est_minutes_per_unit: i.est_minutes_per_unit,
          })
        )
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    setBusy(true);
    setError(null);
    const result = await saveImportedPriceBook(items);
    setBusy(false);
    if (!result.ok) setError(result.message ?? "Could not save");
    else router.push("/pricebook");
  }

  function patchItem(idx: number, patch: Partial<ReviewedItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  const filledJobs = transcripts.filter((t) => t.trim().length >= 10).length;

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Import your prices</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {step === "dictate" && "Teach the AI from past jobs"}
        {step === "review" && "Review what it extracted"}
      </p>

      {step === "dictate" && (
        <div className="mt-6">
          <p className="text-sm text-zinc-600">
            Describe 2–3 typical past jobs out loud — what the job was, what
            you did, and roughly what you charged for each part. The AI turns
            this into price book items.
          </p>

          <div className="mt-4 flex gap-2">
            {transcripts.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveJob(i)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  i === activeJob
                    ? "bg-zinc-900 text-white"
                    : t.trim().length >= 10
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-500"
                }`}
              >
                Job {i + 1}
              </button>
            ))}
            {transcripts.length < 3 && (
              <button
                onClick={() => {
                  setTranscripts((prev) => [...prev, ""]);
                  setActiveJob(transcripts.length);
                }}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-500"
              >
                + Add job
              </button>
            )}
          </div>

          <div className="mt-4">
            <Dictation
              key={activeJob}
              value={transcripts[activeJob]}
              onChange={(next) =>
                setTranscripts((prev) =>
                  prev.map((t, i) => (i === activeJob ? next : t))
                )
              }
              placeholder="e.g. Did a panel upgrade last month — swapped a 100 amp panel for 200 amp, charged $2,800 all in, took most of a day. Permit was $250 on top…"
            />
          </div>

          <button
            onClick={extract}
            disabled={busy || filledJobs === 0}
            className="mt-4 w-full rounded-xl bg-amber-600 py-4 font-semibold text-white disabled:opacity-50"
          >
            {busy
              ? "Building price book items…"
              : `✨ Build items from ${filledJobs} job${filledJobs === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="mt-6">
          <p className="text-sm text-zinc-600">
            Here&apos;s what the AI extracted. Fix any prices or times — these
            are what future quotes are built from.
          </p>
          <ul className="mt-4 space-y-3">
            {items.map((item, idx) => (
              <li
                key={idx}
                className="rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => patchItem(idx, { name: e.target.value })}
                    className="w-full rounded border border-transparent font-medium outline-none focus:border-zinc-300"
                  />
                  <button
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-zinc-400 hover:text-red-500"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {item.description}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <label className="block">
                    <span className="text-[10px] uppercase text-zinc-400">
                      $/unit
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.unit_cost}
                      onChange={(e) =>
                        patchItem(idx, { unit_cost: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase text-zinc-400">
                      Unit
                    </span>
                    <input
                      value={item.unit}
                      onChange={(e) => patchItem(idx, { unit: e.target.value })}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase text-zinc-400">
                      Min/unit
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={item.est_minutes_per_unit}
                      onChange={(e) =>
                        patchItem(idx, {
                          est_minutes_per_unit: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={saveAll}
            disabled={busy || items.length === 0}
            className="mt-4 w-full rounded-xl bg-zinc-900 py-4 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : `Save ${items.length} items`}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
