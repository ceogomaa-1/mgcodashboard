import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const txId = params.id;

  const { data: transaction, error } = await supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,customer_id,type,occurred_at,reference,method,subtotal_cents,discount_type,discount_value,tax_enabled,tax_rate_bps,tax_cents,total_cents,amount_paid_cents,payment_cents,refund_cents,balance_change_cents,receipt_prefix,receipt_number,created_at,retail_customers(full_name,email,phone)"
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
