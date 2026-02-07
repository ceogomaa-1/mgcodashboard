import { NextRequest, NextResponse } from "next/server";
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

async function getLatestBalance(businessId: string, customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("retail_transactions")
    .select("balance_after,occurred_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return 0;
  return data?.balance_after || 0;
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
      "id,customer_id,type,subtotal,discount_amount,tax_rate,tax_amount,total,amount,balance_after,province,memo,occurred_at,retail_customers(full_name)"
    )
    .eq("business_id", guard.client.id)
    .order("occurred_at", { ascending: false });

  if (start) query = query.gte("occurred_at", start);
  if (end) query = query.lte("occurred_at", end);
  if (type) query = query.eq("type", type);
  if (customerId) query = query.eq("customer_id", customerId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data || [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type : null;
  const customerId = typeof body?.customer_id === "string" ? body.customer_id : null;
  const occurredAt = typeof body?.occurred_at === "string" ? body.occurred_at : null;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : null;
  const province = typeof body?.province === "string" ? body.province.trim() : null;

  if (!type || !customerId) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const settingsRes = await ensureRetailSettings(guard.client.id);
  if ("error" in settingsRes) {
    return NextResponse.json({ error: settingsRes.error }, { status: settingsRes.status });
  }

  const settings = settingsRes.settings;
  const defaultTaxRate = (settings.default_tax_rate_bps || 0) / 100;
  const nowIso = new Date().toISOString();
  const previousBalance = await getLatestBalance(guard.client.id, customerId);

  let payload: Record<string, any> = {
    business_id: guard.client.id,
    customer_id: customerId,
    type,
    occurred_at: occurredAt || nowIso,
    province: province || settings.province_code || null,
    memo: memo || null,
  };

  if (type === "sale") {
    const subtotal = toInt(body?.subtotal);
    if (subtotal === null || subtotal < 0) {
      return NextResponse.json({ error: "Subtotal is required." }, { status: 400 });
    }

    const discountAmount = Math.max(0, toInt(body?.discount_amount) || 0);
    const taxRate = Math.max(0, toNumber(body?.tax_rate) ?? defaultTaxRate);
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round((taxableBase * taxRate) / 100);
    const total = taxableBase + taxAmount;
    const amount = Math.max(0, toInt(body?.amount) || 0);
    const balanceAfter = previousBalance + (total - amount);

    payload = {
      ...payload,
      subtotal,
      discount_amount: discountAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      amount,
      balance_after: balanceAfter,
    };
  } else if (type === "payment") {
    const amount = toInt(body?.amount);
    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: "Payment amount is required." }, { status: 400 });
    }

    const balanceAfter = previousBalance - amount;

    payload = {
      ...payload,
      subtotal: null,
      discount_amount: null,
      tax_rate: null,
      tax_amount: null,
      total: -amount,
      amount,
      balance_after: balanceAfter,
    };
  } else if (type === "refund") {
    const amount = toInt(body?.amount);
    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: "Refund amount is required." }, { status: 400 });
    }

    const balanceAfter = previousBalance - amount;

    payload = {
      ...payload,
      subtotal: null,
      discount_amount: null,
      tax_rate: null,
      tax_amount: null,
      total: -amount,
      amount,
      balance_after: balanceAfter,
    };
  } else {
    return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("retail_transactions")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transaction: data }, { status: 201 });
}
