import { NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { ensureRetailSettings } from "@/lib/retail/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

function toInt(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function toNumber(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
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
      "id,customer_id,type,occurred_at,reference,method,subtotal_cents,discount_type,discount_value,tax_enabled,tax_rate_bps,tax_cents,total_cents,amount_paid_cents,payment_cents,refund_cents,balance_change_cents,receipt_prefix,receipt_number,created_at,retail_customers(full_name)"
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

  return NextResponse.json({ transactions: data || [] }, { status: 200 });
}

export async function POST(req: Request) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type : null;
  const customerId = typeof body?.customer_id === "string" ? body.customer_id : null;
  const occurredAt = typeof body?.occurred_at === "string" ? body.occurred_at : null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : null;
  const method = typeof body?.method === "string" ? body.method.trim() : null;

  if (!type || !customerId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const settingsRes = await ensureRetailSettings(guard.client.id);
  if ("error" in settingsRes) {
    return NextResponse.json({ error: settingsRes.error }, { status: settingsRes.status });
  }

  const settings = settingsRes.settings;
  const receiptNumber = settings.next_receipt_number || 1;
  const receiptPrefix = settings.receipt_prefix || "MGCO";

  const nowIso = new Date().toISOString();

  let payload: Record<string, any> = {
    business_id: guard.client.id,
    customer_id: customerId,
    type,
    occurred_at: occurredAt || nowIso,
    reference: reference || null,
    method: method || null,
    receipt_prefix: receiptPrefix,
    receipt_number: receiptNumber,
    created_by_user_id: guard.userId,
    updated_at: nowIso,
  };

  if (type === "sale") {
    const subtotalCents = toInt(body?.subtotal_cents);
    if (subtotalCents === null || subtotalCents < 0) {
      return NextResponse.json({ error: "Subtotal is required." }, { status: 400 });
    }

    const discountType = typeof body?.discount_type === "string" ? body.discount_type : "none";
    let discountValue = toNumber(body?.discount_value);
    if (discountType === "none") discountValue = null;
    if (discountType === "percent" && discountValue !== null) {
      discountValue = Math.min(100, Math.max(0, discountValue));
    }
    if (discountType === "fixed" && discountValue !== null) {
      discountValue = Math.max(0, discountValue);
    }

    let discountCents = 0;
    if (discountType === "percent" && discountValue !== null) {
      discountCents = Math.round((subtotalCents * discountValue) / 100);
    } else if (discountType === "fixed" && discountValue !== null) {
      discountCents = Math.round(discountValue * 100);
    }

    const taxableBase = Math.max(0, subtotalCents - discountCents);

    const taxEnabled =
      typeof body?.tax_enabled === "boolean" ? body.tax_enabled : settings.default_tax_enabled;
    const taxRateBps =
      typeof body?.tax_rate_bps === "number"
        ? Math.max(0, Math.round(body.tax_rate_bps))
        : settings.default_tax_rate_bps;
    const appliedTaxRate = taxEnabled ? taxRateBps : 0;
    const taxCents = taxEnabled ? Math.round((taxableBase * appliedTaxRate) / 10000) : 0;

    const totalCents = taxableBase + taxCents;
    const amountPaidCents = toInt(body?.amount_paid_cents) ?? 0;
    const balanceChange = totalCents - amountPaidCents;

    payload = {
      ...payload,
      subtotal_cents: subtotalCents,
      discount_type: discountType,
      discount_value: discountValue,
      tax_enabled: taxEnabled,
      tax_rate_bps: appliedTaxRate,
      tax_cents: taxCents,
      total_cents: totalCents,
      amount_paid_cents: amountPaidCents,
      balance_change_cents: balanceChange,
      payment_cents: null,
      refund_cents: null,
    };
  } else if (type === "payment") {
    const paymentCents = toInt(body?.payment_cents);
    if (paymentCents === null || paymentCents <= 0) {
      return NextResponse.json({ error: "Payment amount is required." }, { status: 400 });
    }
    payload = {
      ...payload,
      payment_cents: paymentCents,
      total_cents: -paymentCents,
      balance_change_cents: -paymentCents,
      subtotal_cents: null,
      discount_type: "none",
      discount_value: null,
      tax_enabled: false,
      tax_rate_bps: null,
      tax_cents: null,
      amount_paid_cents: 0,
      refund_cents: null,
    };
  } else if (type === "refund") {
    const refundCents = toInt(body?.refund_cents);
    if (refundCents === null || refundCents <= 0) {
      return NextResponse.json({ error: "Refund amount is required." }, { status: 400 });
    }
    payload = {
      ...payload,
      refund_cents: refundCents,
      total_cents: -refundCents,
      balance_change_cents: -refundCents,
      subtotal_cents: null,
      discount_type: "none",
      discount_value: null,
      tax_enabled: false,
      tax_rate_bps: null,
      tax_cents: null,
      amount_paid_cents: 0,
      payment_cents: null,
    };
  } else {
    return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("retail_business_settings")
    .update({
      next_receipt_number: receiptNumber + 1,
      updated_at: nowIso,
    })
    .eq("business_id", guard.client.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("retail_transactions")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transaction: data }, { status: 201 });
}
