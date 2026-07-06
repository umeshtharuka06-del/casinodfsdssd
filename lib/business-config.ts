import { getAllSettings } from "./settings";

// ────────────────────────────────────────────────────────────────────────────
// Typed view over the advanced-business-logic settings (VIP, withdrawal limits,
// withdrawal eligibility, referral qualification). One source of truth: every
// feature reads these helpers, so editing a value in Admin → Config changes
// behaviour everywhere consistently. Mirrors lib/crypto/config.ts.
//
// All thresholds come from Setting rows (with DEFAULT_SETTINGS fallbacks) — no
// business value is hardcoded in feature code.
// ────────────────────────────────────────────────────────────────────────────

export interface VipTier {
  level: number;
  minDepositUsdt: number;
  /** 0 = the referral path is disabled for this tier (deposit-only). */
  minReferrals: number;
  signalGroup: string;
  /** Guaranteed daily signals granted at this tier (0 = none). */
  dailySignals: number;
  /** Whether priority support is included at this tier. */
  prioritySupport: boolean;
  /** Daily login bonus in USDT granted at this tier (0 = none). */
  dailyLoginBonusUsdt: number;
}

export interface VipConfig {
  enabled: boolean;
  tiers: VipTier[]; // ascending by level (VIP1..VIP5)
  banner: {
    enabled: boolean;
    title: string;
    text: string;
  };
}

export interface WithdrawLimits {
  enabled: boolean;
  dailyMaxUsdt: number;
  minUsdt: number;
  receiveFloorUsdt: number;
}

export interface ProfitTier {
  /** Upper bound of the deposit band in USDT, or null for "above the last tier". */
  maxUsdt: number | null;
  requiredProfitUsdt: number;
}

export interface WithdrawEligibility {
  enabled: boolean;
  minQualifiedReferrals: number;
  profitTiers: ProfitTier[]; // ascending, last has maxUsdt = null
}

export interface BusinessConfig {
  referralQualificationEnabled: boolean;
  vip: VipConfig;
  withdrawLimits: WithdrawLimits;
  withdrawEligibility: WithdrawEligibility;
}

/** Parse a setting to a finite number, falling back to `d` on garbage. */
function num(s: Record<string, string>, k: string, d: number): number {
  const n = Number(s[k]);
  return Number.isFinite(n) ? n : d;
}

function bool(s: Record<string, string>, k: string, d = true): boolean {
  const v = s[k];
  if (v === undefined) return d;
  return v !== "false";
}

function str(s: Record<string, string>, k: string, d: string): string {
  const v = (s[k] ?? "").trim();
  return v.length ? v : d;
}

export async function getBusinessConfig(): Promise<BusinessConfig> {
  const s = await getAllSettings();

  const tiers: VipTier[] = [1, 2, 3, 4, 5].map((lvl) => ({
    level: lvl,
    minDepositUsdt: num(s, `vip${lvl}_min_deposit_usdt`, Infinity),
    minReferrals: num(s, `vip${lvl}_min_referrals`, 0),
    signalGroup: str(s, `vip${lvl}_signal_group`, `VIP${lvl} Signal Group`),
    dailySignals: num(s, `vip${lvl}_daily_signals`, 0),
    prioritySupport: bool(s, `vip${lvl}_priority_support`, false),
    dailyLoginBonusUsdt: num(s, `vip${lvl}_daily_login_bonus_usdt`, 0),
  }));

  const profitTiers: ProfitTier[] = [
    { maxUsdt: num(s, "withdraw_profit_t1_max_usdt", 50), requiredProfitUsdt: num(s, "withdraw_profit_t1_usdt", 5) },
    { maxUsdt: num(s, "withdraw_profit_t2_max_usdt", 100), requiredProfitUsdt: num(s, "withdraw_profit_t2_usdt", 10) },
    { maxUsdt: num(s, "withdraw_profit_t3_max_usdt", 500), requiredProfitUsdt: num(s, "withdraw_profit_t3_usdt", 50) },
    { maxUsdt: null, requiredProfitUsdt: num(s, "withdraw_profit_above_usdt", 100) },
  ];

  return {
    referralQualificationEnabled: bool(s, "referral_qualification_enabled"),
    vip: {
      enabled: bool(s, "vip_enabled"),
      tiers,
      banner: {
        enabled: bool(s, "vip_banner_enabled"),
        title: str(s, "vip_banner_title", "Unlock VIP Rewards"),
        text: str(s, "vip_banner_text", ""),
      },
    },
    withdrawLimits: {
      enabled: bool(s, "withdraw_limits_enabled"),
      dailyMaxUsdt: num(s, "withdraw_daily_max_usdt", 300),
      minUsdt: num(s, "withdraw_min_usdt", 11),
      receiveFloorUsdt: num(s, "withdraw_receive_floor_usdt", 10),
    },
    withdrawEligibility: {
      enabled: bool(s, "withdraw_eligibility_enabled"),
      minQualifiedReferrals: num(s, "withdraw_min_qualified_referrals", 2),
      profitTiers,
    },
  };
}

/**
 * Resolve the required net betting profit (USDT) for a given total approved
 * deposit, using the configured tiers. The first tier whose `maxUsdt` bound is
 * not exceeded wins; the final `maxUsdt: null` tier applies to everything above.
 */
export function requiredProfitForDeposit(totalDepositUsdt: number, tiers: ProfitTier[]): number {
  for (const t of tiers) {
    if (t.maxUsdt === null || totalDepositUsdt <= t.maxUsdt) return t.requiredProfitUsdt;
  }
  return tiers.length ? tiers[tiers.length - 1].requiredProfitUsdt : 0;
}
