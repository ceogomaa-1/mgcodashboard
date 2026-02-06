import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let rangeQuery = supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,type,occurred_at,total_cents,payment_cents,refund_cents,balance_change_cents,customer_id,method,reference,receipt_prefix,receipt_number,retail_customers(full_name)"
    )
    .eq("business_id", guard.client.id)
    .order("occurred_at", { ascending: false });

  if (start) rangeQuery = rangeQuery.gte("occurred_at", start);
  if (end) rangeQuery = rangeQuery.lte("occurred_at", end);

  const { data: rangeTx, error: rangeErr } = await rangeQuery;
  if (rangeErr) return NextResponse.json({ error: rangeErr.message }, { status: 500 });

  let salesTotal = 0;
  let paymentsTotal = 0;
  let refundsTotal = 0;

  for (const tx of rangeTx || []) {
    if (tx.type === "sale") salesTotal += tx.total_cents || 0;
    if (tx.type === "payment") paymentsTotal += tx.payment_cents || 0;
    if (tx.type === "refund") refundsTotal += tx.refund_cents || 0;
  }

  const { data: allTx, error: allErr } = await supabaseAdmin
    .from("retail_transactions")
    .select("customer_id,balance_change_cents")
    .eq("business_id", guard.client.id);

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const balanceByCustomer: Record<string, number> = {};
  for (const tx of allTx || []) {
    if (!tx.customer_id) continue;
    balanceByCustomer[tx.customer_id] =
      (balanceByCustomer[tx.customer_id] || 0) + (tx.balance_change_cents || 0);
  }

  const outstandingReceivables = Object.values(balanceByCustomer).reduce(
    (acc, value) => (value > 0 ? acc + value : acc),
    0
  );

  const recentTransactions = (rangeTx || []).slice(0, 8);

  return NextResponse.json(
    {
      kpis: {
        sales_total_cents: salesTotal,
        payments_total_cents: paymentsTotal,
        refunds_total_cents: refundsTotal,
        net_cashflow_cents: paymentsTotal - refundsTotal,
        outstanding_receivables_cents: outstandingReceivables,
      },
      recent_transactions: recentTransactions,
    },
    { status: 200 }
  );
}
