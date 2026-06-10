"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dictation from "@/components/Dictation";

export default function NewQuotePage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">New Quote</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Describe the job like you&apos;d explain it to your apprentice —
        what&apos;s being installed, where, distances, anything unusual.
      </p>

      <div className="mt-6">
        <Dictation
          value={transcript}
          onChange={setTranscript}
          placeholder="e.g. Customer wants a sauna hooked up. Need a 50 amp breaker in the main panel, have to move a couple breakers to make room, run about 20 feet of 6/2 out to the sauna, 240 volt disconnect, add a GFCI outlet next to it, then hardwire the control box and the 9 kW heater…"
        />
      </div>

      <button
        onClick={generate}
        disabled={generating || transcript.trim().length < 10}
        className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-4 text-base font-semibold text-white shadow disabled:opacity-50"
      >
        {generating ? "Building your quote…" : "✨ Generate quote"}
      </button>
      {generating && (
        <p className="mt-2 text-center text-sm text-zinc-500">
          Matching your price book — this takes ~20 seconds.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
