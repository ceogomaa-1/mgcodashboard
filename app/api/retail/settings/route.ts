import { NextRequest, NextResponse } from "next/server";
import { requireRetailClient } from "@/lib/retail/guard";
import { ensureRetailSettings } from "@/lib/retail/settings";
import { getProvinceTaxBps, normalizeProvinceCode } from "@/lib/retail/tax";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const settingsRes = await ensureRetailSettings(guard.client.id);
  if ("error" in settingsRes) {
    return NextResponse.json({ error: settingsRes.error }, { status: settingsRes.status });
  }

  return NextResponse.json({ settings: settingsRes.settings }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRetailClient();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await req.json().catch(() => ({}));
  const province = normalizeProvinceCode(body?.province_code);
  const defaultTaxEnabled =
    typeof body?.default_tax_enabled === "boolean" ? body.default_tax_enabled : undefined;

  const defaultTaxRateBps =
    typeof body?.default_tax_rate_bps === "number" ? Math.round(body.default_tax_rate_bps) : undefined;

  const receiptPrefix =
    typeof body?.receipt_prefix === "string" ? body.receipt_prefix.trim() : undefined;
  const currencyCode =
    typeof body?.currency_code === "string" ? body.currency_code.trim().toUpperCase() : undefined;

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (province) {
    patch.province_code = province;
    patch.default_tax_rate_bps = getProvinceTaxBps(province);
  }
  if (typeof defaultTaxEnabled === "boolean") patch.default_tax_enabled = defaultTaxEnabled;
  if (typeof defaultTaxRateBps === "number" && Number.isFinite(defaultTaxRateBps)) {
    patch.default_tax_rate_bps = Math.max(0, defaultTaxRateBps);
  }
  if (typeof receiptPrefix === "string" && receiptPrefix.length > 0) {
    patch.receipt_prefix = receiptPrefix.slice(0, 12);
  }
  if (typeof currencyCode === "string" && currencyCode.length > 0) {
    patch.currency_code = currencyCode.slice(0, 6);
  }

  const { data, error } = await supabaseAdmin
    .from("retail_business_settings")
    .update(patch)
    .eq("business_id", guard.client.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: data }, { status: 200 });
}
