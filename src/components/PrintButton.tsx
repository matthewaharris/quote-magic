"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print-hide w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700"
    >
      🖨️ Print / save as PDF
    </button>
  );
}
