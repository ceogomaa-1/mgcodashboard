export const PROVINCE_TAX_BPS: Record<string, number> = {
  ON: 1300,
  BC: 500,
  AB: 500,
  MB: 500,
  NB: 1500,
  NL: 1500,
  NS: 1500,
  NT: 500,
  NU: 500,
  PE: 1500,
  QC: 500,
  SK: 500,
  YT: 500,
};

export function normalizeProvinceCode(value?: string | null) {
  const raw = (value || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.length === 2) return raw;
  return null;
}

export function getProvinceTaxBps(code?: string | null) {
  const normalized = normalizeProvinceCode(code);
  if (!normalized) return PROVINCE_TAX_BPS.ON;
  return PROVINCE_TAX_BPS[normalized] ?? PROVINCE_TAX_BPS.ON;
}
