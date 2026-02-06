import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProvinceTaxBps, normalizeProvinceCode } from "@/lib/retail/tax";

export type RetailSettings = {
  business_id: string;
  province_code: string | null;
  default_tax_enabled: boolean;
  default_tax_rate_bps: number;
  currency_code: string;
  receipt_prefix: string;
  next_receipt_number: number;
  updated_at: string | null;
};

export async function ensureRetailSettings(businessId: string) {
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("retail_business_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existingErr) {
    return { error: existingErr.message, status: 500 };
  }

  if (existing) return { settings: existing as RetailSettings };

  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .select("state")
    .eq("id", businessId)
    .maybeSingle();

  if (clientErr) return { error: clientErr.message, status: 500 };

  const province = normalizeProvinceCode(client?.state) ?? "ON";
  const rate = getProvinceTaxBps(province);

  const insertPayload = {
    business_id: businessId,
    province_code: province,
    default_tax_enabled: true,
    default_tax_rate_bps: rate,
    currency_code: "CAD",
    receipt_prefix: "MGCO",
    next_receipt_number: 1,
    updated_at: new Date().toISOString(),
  };

  const { data: created, error: createErr } = await supabaseAdmin
    .from("retail_business_settings")
    .insert(insertPayload)
    .select()
    .single();

  if (createErr) return { error: createErr.message, status: 500 };

  return { settings: created as RetailSettings };
}
