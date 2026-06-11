import QRCode from "qrcode";
import { requireContractor } from "@/lib/contractor";
import PrintButton from "@/components/PrintButton";

// Printable "QR card for the truck": scanning lands on the QuoteMagic
// landing page with the contractor's referral id attached.
export default async function QrCardPage() {
  const { contractor } = await requireContractor();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://quotemagic.app";
  const refUrl = `${base}/?ref=${contractor.id}`;
  const qrDataUrl = await QRCode.toDataURL(refUrl, {
    width: 480,
    margin: 1,
    color: { dark: "#18181b", light: "#ffffff" },
  });

  return (
    <div>
      <h1 className="print-hide text-xl font-bold text-zinc-900">
        QR card for the truck
      </h1>
      <p className="print-hide mt-1 text-sm text-zinc-500">
        Print it, laminate it, stick it on the truck or hand it out. Scans
        land on QuoteMagic with your referral attached.
      </p>

      <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200">
        {contractor.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contractor.logo_url}
            alt=""
            className="mx-auto h-14 max-w-40 object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/quotemagic-icon.png"
            alt=""
            className="mx-auto h-14 w-14 rounded-xl"
          />
        )}
        <p className="mt-3 text-xl font-bold text-zinc-900">
          {contractor.business_name || contractor.name}
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-600">
          Scan for an instant quote
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt={refUrl}
          className="mx-auto mt-4 h-56 w-56"
        />
        {contractor.phone && (
          <p className="mt-3 text-sm text-zinc-600">{contractor.phone}</p>
        )}
        <p className="mt-4 text-[11px] text-zinc-400">
          ⚡ Powered by QuoteMagic
        </p>
      </div>

      <div className="mx-auto mt-4 max-w-sm">
        <PrintButton />
      </div>
    </div>
  );
}
