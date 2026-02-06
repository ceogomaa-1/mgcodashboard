import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeString(value: any) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id: customerId } = await params;
  const { data: customer, error } = await supabaseAdmin
    .from("retail_customers")
    .select("id,full_name,phone,email,notes,status,created_at,updated_at")
    .eq("business_id", guard.client.id)
    .eq("id", customerId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: transactions, error: txErr } = await supabaseAdmin
    .from("retail_transactions")
    .select(
      "id,type,occurred_at,reference,method,subtotal_cents,discount_type,discount_value,tax_enabled,tax_rate_bps,tax_cents,total_cents,amount_paid_cents,payment_cents,refund_cents,balance_change_cents,receipt_prefix,receipt_number,created_at"
    )
    .eq("business_id", guard.client.id)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  return NextResponse.json({ customer, transactions: transactions || [] }, { status: 200 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id: customerId } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body?.full_name === "string" && body.full_name.trim()) {
    patch.full_name = body.full_name.trim();
  }
  if (typeof body?.phone === "string") patch.phone = safeString(body.phone) || null;
  if (typeof body?.email === "string") patch.email = safeString(body.email) || null;
  if (typeof body?.notes === "string") patch.notes = safeString(body.notes) || null;
  if (typeof body?.status === "string" && body.status.trim()) patch.status = body.status.trim();

  const { data, error } = await supabaseAdmin
    .from("retail_customers")
    .update(patch)
    .eq("business_id", guard.client.id)
    .eq("id", customerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customer: data }, { status: 200 });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id: customerId } = await params;
  const { error } = await supabaseAdmin
    .from("retail_customers")
    .delete()
    .eq("business_id", guard.client.id)
    .eq("id", customerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
