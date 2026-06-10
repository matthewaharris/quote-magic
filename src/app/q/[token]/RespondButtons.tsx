"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RespondButtons({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    if (
      action === "decline" &&
      !confirm("Decline this quote? The contractor will be notified.")
    ) {
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/q/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div>
      <button
        onClick={() => respond("accept")}
        disabled={busy !== null}
        className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow disabled:opacity-50"
      >
        {busy === "accept" ? "Accepting…" : "Accept quote"}
      </button>
      <button
        onClick={() => respond("decline")}
        disabled={busy !== null}
        className="mt-3 w-full rounded-2xl border border-zinc-300 bg-white py-3 font-medium text-zinc-600 disabled:opacity-50"
      >
        {busy === "decline" ? "Declining…" : "Decline"}
      </button>
      {error && (
        <p className="mt-3 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
