import { NextRequest, NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let query = supabaseAdmin
    .from("retail_transactions")
    .select("type,occurred_at,total,amount")
    .eq("business_id", guard.client.id)
    .order("occurred_at", { ascending: true });

  if (start) query = query.gte("occurred_at", start);
  if (end) query = query.lte("occurred_at", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const buckets: Record<
    string,
    { date: string; sales_cents: number; payments_cents: number; refunds_cents: number }
  > = {};

  for (const tx of data || []) {
    const date = new Date(tx.occurred_at).toISOString().slice(0, 10);
    if (!buckets[date]) {
      buckets[date] = { date, sales_cents: 0, payments_cents: 0, refunds_cents: 0 };
    }
    if (tx.type === "sale") buckets[date].sales_cents += tx.total || 0;
    if (tx.type === "payment") buckets[date].payments_cents += tx.amount || 0;
    if (tx.type === "refund") buckets[date].refunds_cents += tx.amount || 0;
  }

  const rows = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ rows }, { status: 200 });
}
