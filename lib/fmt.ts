/**
 * Coin display formatter (UI only — does NOT touch stored values).
 *
 * The backend returns coin amounts as already-formatted strings like
 * "8,244.00". Per the product spec, coin/balance amounts must render as whole
 * numbers with NO thousands separators and NO trailing decimals:
 *   "8,244.00" → "8244"   ·   "855.00" → "855"   ·   -100.00 → "-100"
 *
 * We strip commas and drop the fractional part (truncate) so the underlying
 * ledger value is never rounded up. Non-coin currency (USDT) is unaffected.
 */
export function coins(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "0";
  const s = String(v).replace(/,/g, "").replace(/\.\d+$/, "");
  return s === "" || s === "-" ? "0" : s;
}
