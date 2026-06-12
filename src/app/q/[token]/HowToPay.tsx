// Manual-payments card: shows the contractor's own payment instructions
// (Zelle, check, their payment link…) in place of an online checkout.
// The contractor records the payment from their side when it lands.
export default function HowToPay({
  heading,
  amount,
  instructions,
  businessName,
  phone,
  note,
}: {
  heading: string;
  amount: string;
  instructions: string | null;
  businessName: string;
  phone: string | null;
  note?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h3 className="font-semibold text-zinc-900">{heading}</h3>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{amount}</p>
      {instructions ? (
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-600">
          {instructions}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">
          Contact {businessName}
          {phone ? ` at ${phone}` : ""} to arrange payment.
        </p>
      )}
      {note && <p className="mt-3 text-xs text-zinc-400">{note}</p>}
    </div>
  );
}
