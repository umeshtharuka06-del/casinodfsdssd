import { requireUser } from "@/lib/auth";
import { getVipContext } from "@/lib/vip";
import { getBusinessConfig } from "@/lib/business-config";
import { tierBenefits, tierRequirement } from "@/lib/vip-display";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// The signed-in user's VIP status: current tier, all tiers + benefits, progress
// to the next tier, and the promotional banner config. Everything is derived
// from admin-configurable settings.
export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Not authenticated.", 401);

  const [ctx, cfg] = await Promise.all([getVipContext(user.id), getBusinessConfig()]);
  const { vip } = cfg;

  const tiers = vip.tiers.map((t) => ({
    level: t.level,
    minDepositUsdt: t.minDepositUsdt,
    minReferrals: t.minReferrals,
    signalGroup: t.signalGroup,
    dailySignals: t.dailySignals,
    prioritySupport: t.prioritySupport,
    dailyLoginBonusUsdt: t.dailyLoginBonusUsdt,
    requirement: tierRequirement(t),
    benefits: tierBenefits(t),
    achieved: ctx.effectiveLevel >= t.level,
  }));

  // Progress toward the next tier the user has not yet reached.
  const next = vip.tiers.find((t) => t.level > ctx.effectiveLevel) ?? null;
  const progress = next
    ? {
        level: next.level,
        depositPct: Math.min(100, Math.round((ctx.totalDepositUsdt / next.minDepositUsdt) * 100)),
        depositRemainingUsdt: Math.max(0, +(next.minDepositUsdt - ctx.totalDepositUsdt).toFixed(2)),
        referralPct:
          next.minReferrals > 0
            ? Math.min(100, Math.round((ctx.qualifiedReferrals / next.minReferrals) * 100))
            : null,
        referralRemaining:
          next.minReferrals > 0 ? Math.max(0, next.minReferrals - ctx.qualifiedReferrals) : null,
      }
    : null;

  return ok({
    enabled: vip.enabled,
    level: ctx.effectiveLevel,
    isOverridden: ctx.override !== null,
    totalDepositUsdt: ctx.totalDepositUsdt,
    qualifiedReferrals: ctx.qualifiedReferrals,
    currentTier: ctx.tier
      ? { level: ctx.tier.level, benefits: tierBenefits(ctx.tier), signalGroup: ctx.tier.signalGroup }
      : null,
    tiers,
    progress,
    banner: vip.banner,
  });
}
