import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Landing, { TRADE_COPY } from "@/components/Landing";

export function generateStaticParams() {
  return Object.keys(TRADE_COPY).map((trade) => ({ trade }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trade: string }>;
}): Promise<Metadata> {
  const { trade } = await params;
  const copy = TRADE_COPY[trade];
  if (!copy) return {};
  return {
    title: `QuoteMagic for ${copy.plural} — dictate the job, send the quote, same day`,
    description: `AI quoting built for solo ${copy.plural}: dictate the job, send a quote from your own price book, and let the customer accept, schedule, and get their invoice online.`,
  };
}

export default async function TradeLandingPage({
  params,
}: {
  params: Promise<{ trade: string }>;
}) {
  const { trade } = await params;
  const copy = TRADE_COPY[trade];
  if (!copy) notFound();

  return <Landing trade={copy} />;
}
