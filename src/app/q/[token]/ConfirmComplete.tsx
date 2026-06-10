"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmComplete({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [note, setNote] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "confirm" | "dispute") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/q/${token}/confirm-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      if (action === "dispute") {
        setFlagged(true);
        setBusy(false);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (flagged) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-800 ring-1 ring-amber-200">
        Thanks — {businessName} has been notified and will follow up with you.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h3 className="font-semibold text-zinc-900">
        {businessName} reports this job is complete
      </h3>
      <p className="mt-0.5 text-sm text-zinc-500">
        Confirm everything looks good and we&apos;ll send your invoice.
      </p>
      <button
        onClick={() => send("confirm")}
        disabled={busy}
        className="mt-4 w-full rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Confirming…" : "✓ Confirm job complete"}
      </button>

      {showDispute ? (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's not right?"
            rows={2}
            className="w-full rounded-xl border border-zinc-300 p-2 text-sm"
          />
          <button
            onClick={() => send("dispute")}
            disabled={busy}
            className="mt-2 w-full rounded-xl border border-amber-400 py-2.5 text-sm font-medium text-amber-700 disabled:opacity-50"
          >
            Send to {businessName}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowDispute(true)}
          className="mt-2 w-full py-1 text-sm text-zinc-400 underline"
        >
          Something&apos;s not right
        </button>
      )}
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
