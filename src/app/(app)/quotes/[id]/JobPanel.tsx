"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type Invoice, type Job } from "@/lib/types";
import { formatSlotRange } from "@/lib/scheduling";
import { generateInvoiceNow, markJobComplete } from "./actions";

const stageLabels: Record<Job["status"], string> = {
  unscheduled: "Accepted — waiting on customer to pick a time",
  scheduled: "Scheduled",
  done_reported: "Waiting on customer to confirm completion",
  confirmed: "Customer confirmed — invoicing",
  invoiced: "Invoice sent",
  paid: "Paid",
};

export default function JobPanel({
  job,
  invoice,
  shareToken,
}: {
  job: Job;
  invoice: Invoice | null;
  shareToken: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string } & Record<string, unknown>>) {
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? null : (result.message ?? "Something went wrong"));
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Job
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            job.status === "paid"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {stageLabels[job.status]}
        </span>
      </div>

      {job.scheduled_start && job.scheduled_end && (
        <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm font-medium text-sky-900">
          📅 {formatSlotRange(job.scheduled_start, job.scheduled_end)}
          <a
            href={`/api/q/${shareToken}/calendar.ics`}
            className="print-hide mt-1 block text-xs font-medium text-sky-700 underline underline-offset-2"
          >
            Add to calendar
          </a>
        </div>
      )}

      {Number(job.deposit_amount) > 0 && (
        <p className="mt-3 text-sm text-zinc-600">
          Deposit {formatMoney(Number(job.deposit_amount))} —{" "}
          {job.deposit_paid_at ? (
            <span className="font-medium text-emerald-700">
              paid ✓ (Ref {job.deposit_ref})
            </span>
          ) : (
            <span className="font-medium text-amber-700">
              awaiting customer
            </span>
          )}
        </p>
      )}

      {["unscheduled", "scheduled"].includes(job.status) && (
        <button
          onClick={() => run(() => markJobComplete(job.id))}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "✅ Mark job complete"}
        </button>
      )}

      {job.status === "done_reported" && (
        <div className="mt-3">
          <p className="text-sm text-zinc-500">
            The customer was asked to confirm completion. They&apos;ll get the
            invoice automatically when they do.
          </p>
          <button
            onClick={() => run(() => generateInvoiceNow(job.id))}
            disabled={busy}
            className="mt-2 w-full rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Generate invoice without confirmation"}
          </button>
        </div>
      )}

      {invoice && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 p-3 text-sm">
          <div>
            <p className="font-semibold text-zinc-900">
              Invoice {invoice.number}
            </p>
            <p className="text-xs text-zinc-500">
              {invoice.status === "paid"
                ? `Paid · Ref ${invoice.payment_ref}`
                : `Due ${new Date(invoice.due_at).toLocaleDateString()}`}
            </p>
          </div>
          <span
            className={`font-bold ${invoice.status === "paid" ? "text-emerald-700" : "text-zinc-900"}`}
          >
            {formatMoney(Number(invoice.total))}
          </span>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
    </div>
  );
}
