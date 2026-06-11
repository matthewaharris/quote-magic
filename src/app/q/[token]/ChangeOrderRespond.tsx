"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangeOrderRespond({
  token,
  changeOrderId,
}: {
  token: string;
  changeOrderId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "approve" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/q/${token}/change-orders/${changeOrderId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => respond("approve")}
          disabled={busy}
          className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={busy}
          className="rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-700 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
