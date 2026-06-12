// How money moves between the customer and the contractor.
//
//   manual — the live default. Customers see the contractor's
//            payment_instructions; the contractor records deposits and
//            invoice payments by hand from the quote page.
//   demo   — the simulated card checkout (clearly labeled, SIM-* refs).
//            Set PAYMENTS_MODE=demo to restore it (used for demos).
//   stripe — future: real card collection via Stripe Connect (contractor
//            onboarding, destination charges, platform fee). When built,
//            add it here and branch in the same places demo does today:
//            /q page deposit + invoice sections and the two
//            /api/q/[token]/pay* routes.
export type PaymentsMode = "manual" | "demo";

export function paymentsMode(): PaymentsMode {
  return process.env.PAYMENTS_MODE === "demo" ? "demo" : "manual";
}
