import { NextRequest, NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id: txId } = await params;

  const { data: transaction, error } = await supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,customer_id,type,subtotal,discount_amount,tax_rate,tax_amount,total,amount,balance_after,province,memo,occurred_at,retail_customers(full_name,email,phone)"
    )
    .eq("business_id", guard.client.id)
    .eq("id", txId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: business, error: businessErr } = await supabaseAdmin
    .from("clients")
    .select("business_name")
    .eq("id", guard.client.id)
    .maybeSingle();

  if (businessErr) return NextResponse.json({ error: businessErr.message }, { status: 500 });

  return NextResponse.json(
    {
      transaction,
      business: business || { business_name: guard.client.business_name },
    },
    { status: 200 }
  );
}
