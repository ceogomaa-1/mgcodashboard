import { NextRequest, NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function csvEscape(value: any) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const type = url.searchParams.get("type");
  const customerId = url.searchParams.get("customer_id");

  let query = supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,type,occurred_at,subtotal,discount_amount,tax_rate,tax_amount,total,amount,balance_after,province,memo,retail_customers(full_name)"
    )
    .eq("business_id", guard.client.id)
    .order("occurred_at", { ascending: false });

  if (start) query = query.gte("occurred_at", start);
  if (end) query = query.lte("occurred_at", end);
  if (type) query = query.eq("type", type);
  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "date",
    "type",
    "customer",
    "subtotal",
    "discount_amount",
    "tax_rate",
    "tax_amount",
    "total",
    "amount",
    "balance_after",
    "province",
    "memo",
  ];

  const rows = (data || []).map((tx: any) => [
    tx.occurred_at,
    tx.type,
    tx.retail_customers?.full_name || "",
    tx.subtotal ?? "",
    tx.discount_amount ?? "",
    tx.tax_rate ?? "",
    tx.tax_amount ?? "",
    tx.total ?? "",
    tx.amount ?? "",
    tx.balance_after ?? "",
    tx.province ?? "",
    tx.memo ?? "",
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
