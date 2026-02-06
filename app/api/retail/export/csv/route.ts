import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function csvEscape(value: any) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const type = url.searchParams.get("type");
  const customerId = url.searchParams.get("customer_id");
  const method = url.searchParams.get("method");

  let query = supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,type,occurred_at,reference,method,subtotal_cents,discount_type,discount_value,tax_enabled,tax_rate_bps,tax_cents,total_cents,amount_paid_cents,payment_cents,refund_cents,balance_change_cents,receipt_prefix,receipt_number,retail_customers(full_name)"
    )
    .eq("business_id", guard.client.id)
    .order("occurred_at", { ascending: false });

  if (start) query = query.gte("occurred_at", start);
  if (end) query = query.lte("occurred_at", end);
  if (type) query = query.eq("type", type);
  if (customerId) query = query.eq("customer_id", customerId);
  if (method) query = query.eq("method", method);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "date",
    "type",
    "customer",
    "method",
    "subtotal_cents",
    "discount_type",
    "discount_value",
    "tax_enabled",
    "tax_rate_bps",
    "tax_cents",
    "total_cents",
    "amount_paid_cents",
    "payment_cents",
    "refund_cents",
    "balance_change_cents",
    "receipt_number",
    "reference",
  ];

  const rows = (data || []).map((tx: any) => [
    tx.occurred_at,
    tx.type,
    tx.retail_customers?.full_name || "",
    tx.method || "",
    tx.subtotal_cents ?? "",
    tx.discount_type ?? "",
    tx.discount_value ?? "",
    tx.tax_enabled ?? "",
    tx.tax_rate_bps ?? "",
    tx.tax_cents ?? "",
    tx.total_cents ?? "",
    tx.amount_paid_cents ?? "",
    tx.payment_cents ?? "",
    tx.refund_cents ?? "",
    tx.balance_change_cents ?? "",
    tx.receipt_prefix && tx.receipt_number ? `${tx.receipt_prefix}-${tx.receipt_number}` : "",
    tx.reference || "",
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=retail-transactions.csv",
    },
  });
}
