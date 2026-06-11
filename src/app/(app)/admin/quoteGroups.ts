// A good/better/best generation is 3 sibling quote rows — group them so every
// admin stat counts it as ONE quote. A group is "accepted" if ANY tier was
// (accepting one declines the siblings, and it may not be the 'better' row).

export interface QuoteRow {
  id: string;
  contractor_id: string;
  created_at: string;
  status: string;
  tier_group_id: string | null;
}

export interface QuoteGroup {
  contractorId: string;
  createdAt: string;
  accepted: boolean;
  sent: boolean;
}

export function groupQuotes(rows: QuoteRow[]): QuoteGroup[] {
  const groups = new Map<string, QuoteGroup>();
  for (const q of rows) {
    const key = q.tier_group_id ?? q.id;
    const g = groups.get(key) ?? {
      contractorId: q.contractor_id,
      createdAt: q.created_at,
      accepted: false,
      sent: false,
    };
    if (q.created_at < g.createdAt) g.createdAt = q.created_at;
    if (q.status === "accepted") g.accepted = true;
    if (q.status !== "draft") g.sent = true;
    groups.set(key, g);
  }
  return [...groups.values()];
}
