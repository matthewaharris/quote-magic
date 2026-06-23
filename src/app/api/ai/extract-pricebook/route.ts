import { NextResponse } from "next/server";
import { getContractor } from "@/lib/contractor";
import { extractPriceBook } from "@/lib/ai/quote";
import { capabilitiesFor } from "@/lib/plan";

export const maxDuration = 120;

export async function POST(request: Request) {
  const ctx = await getContractor();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contractor } = ctx;

  // AI bulk import is a Solo+ perk. Basic still builds its price book by hand.
  if (!capabilitiesFor(contractor).bulkImport) {
    return NextResponse.json(
      { error: "AI import is available on Solo and Pro." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    transcripts?: string[];
  } | null;
  const transcripts = (body?.transcripts ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length >= 10);

  if (transcripts.length === 0) {
    return NextResponse.json(
      { error: "Describe at least one past job first." },
      { status: 400 }
    );
  }

  try {
    const result = await extractPriceBook({
      transcripts,
      trade: contractor.trade,
      hourlyRate: Number(contractor.hourly_rate),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("extractPriceBook failed:", err);
    return NextResponse.json(
      { error: "Extraction failed. Try again." },
      { status: 502 }
    );
  }
}
