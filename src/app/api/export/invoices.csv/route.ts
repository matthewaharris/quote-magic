import { NextResponse } from "next/server";
import { getContractor } from "@/lib/contractor";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US");
}

// QuickBooks-importable invoice export: one row per line item, plus rows
// for approved change orders and the deposit credit.
export async function GET() {
  const ctx = await getContractor();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, contractor } = ctx;

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "number, issued_at, due_at, deposit_applied, change_orders_total, quote_id, quotes!inner(contractor_id, title, customer_id)"
    )
    .eq("quotes.contractor_id", contractor.id)
    .order("issued_at", { ascending: true });

  const rows: string[] = [
    "InvoiceNo,Customer,InvoiceDate,DueDate,Item,Description,Quantity,Rate,Amount",
  ];

  for (const inv of invoices ?? []) {
    const quote = Array.isArray(inv.quotes) ? inv.quotes[0] : inv.quotes;

    let customerName = "Customer";
    if (quote?.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name")
        .eq("id", quote.customer_id)
        .maybeSingle();
      if (customer?.name) customerName = customer.name;
    }

    const base = [
      csvField(inv.number),
      csvField(customerName),
      csvField(csvDate(inv.issued_at)),
      csvField(csvDate(inv.due_at)),
    ].join(",");

    const { data: lines } = await supabase
      .from("quote_line_items")
      .select("name, description, qty, unit_price, line_total")
      .eq("quote_id", inv.quote_id)
      .order("sort_order");
    for (const line of lines ?? []) {
      rows.push(
        `${base},${csvField(line.name)},${csvField(line.description ?? "")},${Number(line.qty)},${Number(line.unit_price)},${Number(line.line_total)}`
      );
    }

    if (Number(inv.change_orders_total) > 0) {
      const { data: cos } = await supabase
        .from("change_orders")
        .select("title, amount")
        .eq("quote_id", inv.quote_id)
        .eq("status", "approved");
      for (const co of cos ?? []) {
        rows.push(
          `${base},${csvField(`Change order: ${co.title}`)},${csvField("Approved change order")},1,${Number(co.amount)},${Number(co.amount)}`
        );
      }
    }

    if (Number(inv.deposit_applied) > 0) {
      rows.push(
        `${base},${csvField("Deposit credit")},${csvField("Deposit collected at acceptance")},1,${-Number(inv.deposit_applied)},${-Number(inv.deposit_applied)}`
      );
    }
  }

  return new NextResponse(rows.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quotemagic-invoices.csv"',
    },
  });
}
