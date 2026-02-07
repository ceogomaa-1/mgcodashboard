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

  let rangeQuery = supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,type,occurred_at,total,amount,balance_after,customer_id,province,memo,retail_customers(full_name)"
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
    if (tx.type === "sale") salesTotal += tx.total || 0;
    if (tx.type === "payment") paymentsTotal += tx.amount || 0;
    if (tx.type === "refund") refundsTotal += tx.amount || 0;
  }

  const { data: allTx, error: allErr } = await supabaseAdmin
    .from("retail_transactions")
    .select("customer_id,balance_after,occurred_at")
    .eq("business_id", guard.client.id);

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const balanceByCustomer: Record<string, number> = {};
  const lastActivity: Record<string, string> = {};
  for (const tx of allTx || []) {
    if (!tx.customer_id) continue;
    const occurred = tx.occurred_at as string | null;
    if (!occurred) continue;
    if (!lastActivity[tx.customer_id]) {
      lastActivity[tx.customer_id] = occurred;
      balanceByCustomer[tx.customer_id] = tx.balance_after || 0;
      continue;
    }
    if (new Date(occurred).getTime() > new Date(lastActivity[tx.customer_id]).getTime()) {
      lastActivity[tx.customer_id] = occurred;
      balanceByCustomer[tx.customer_id] = tx.balance_after || 0;
    }
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
