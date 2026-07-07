import { prisma } from "./db";
import { getBusinessConfig, VipTier } from "./business-config";
import { getEffectiveQualifiedReferrals } from "./referral-qualification";
import { notifyVipChanged } from "./telegram";

// ────────────────────────────────────────────────────────────────────────────
// VIP system (Part 5).
//
// A user reaches a tier by meeting its deposit threshold OR (when configured)
// its qualified-referral threshold. The level is recomputed automatically on
// qualifying events (deposit approval) and cached on `User.vipLevel`. An admin
// can pin the level via `User.vipOverride` (non-null suppresses auto-recompute).
// Every change is written to VIPHistory. All thresholds come from settings.
// ────────────────────────────────────────────────────────────────────────────

export type VipChangeReason =
  | "AUTO_DEPOSIT"
  | "AUTO_REFERRAL"
  | "ADMIN_OVERRIDE"
  | "ADMIN_CLEAR_OVERRIDE";

export interface VipContext {
  totalDepositUsdt: number;
  qualifiedReferrals: number;
  computedLevel: number; // level from thresholds alone
  override: number | null; // admin pin, if any
  effectiveLevel: number; // override ?? computedLevel (what the user actually has)
  tier: VipTier | null; // benefits for the effective level
  tiers: VipTier[]; // all configured tiers (for banners / progress)
}

/** Sum of the user's APPROVED deposits, in USDT. */
export async function getTotalApprovedDepositUsdt(userId: string): Promise<number> {
  const agg = await prisma.deposit.aggregate({
    _sum: { amountUsdt: true },
    where: { userId, status: "APPROVED" },
  });
  return agg._sum.amountUsdt ?? 0;
}

/** Highest tier whose deposit OR referral threshold is satisfied. 0 = none. */
export function computeVipLevel(
  totalDepositUsdt: number,
  qualifiedReferrals: number,
  tiers: VipTier[]
): number {
  let level = 0;
  for (const t of tiers) {
    const byDeposit = totalDepositUsdt >= t.minDepositUsdt;
    const byReferral = t.minReferrals > 0 && qualifiedReferrals >= t.minReferrals;
    if (byDeposit || byReferral) level = Math.max(level, t.level);
  }
  return level;
}

/** Assemble the full VIP picture for a user (no writes). */
export async function getVipContext(userId: string): Promise<VipContext> {
  const cfg = (await getBusinessConfig()).vip;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { vipOverride: true },
  });
  const [totalDepositUsdt, qualifiedReferrals] = await Promise.all([
    getTotalApprovedDepositUsdt(userId),
    getEffectiveQualifiedReferrals(userId),
  ]);

  const computedLevel = cfg.enabled
    ? computeVipLevel(totalDepositUsdt, qualifiedReferrals, cfg.tiers)
    : 0;
  const override = user?.vipOverride ?? null;
  const effectiveLevel = override ?? computedLevel;
  const tier = cfg.tiers.find((t) => t.level === effectiveLevel) ?? null;

  return {
    totalDepositUsdt,
    qualifiedReferrals,
    computedLevel,
    override,
    effectiveLevel,
    tier,
    tiers: cfg.tiers,
  };
}

/**
 * Recompute and persist a user's VIP level from current metrics. No-op when an
 * admin override is set (the override pins the level). Writes a VIPHistory row
 * when the effective level changes. Never throws into the caller's critical
 * path — deposit crediting must not fail because a VIP write did.
 */
export async function recomputeVipForUser(
  userId: string,
  reason: VipChangeReason = "AUTO_DEPOSIT"
): Promise<number | null> {
  try {
    const cfg = (await getBusinessConfig()).vip;
    if (!cfg.enabled) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipLevel: true, vipOverride: true, username: true },
    });
    if (!user) return null;
    if (user.vipOverride !== null) {
      // Override pins the level; keep the cache aligned but don't recompute.
      if (user.vipLevel !== user.vipOverride) {
        await prisma.user.update({ where: { id: userId }, data: { vipLevel: user.vipOverride } });
      }
      return user.vipOverride;
    }

    const [totalDepositUsdt, qualifiedReferrals] = await Promise.all([
      getTotalApprovedDepositUsdt(userId),
      getEffectiveQualifiedReferrals(userId),
    ]);
    const newLevel = computeVipLevel(totalDepositUsdt, qualifiedReferrals, cfg.tiers);

    if (newLevel !== user.vipLevel) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { vipLevel: newLevel } }),
        prisma.vIPHistory.create({
          data: {
            userId,
            oldLevel: user.vipLevel,
            newLevel,
            reason,
            detail: JSON.stringify({ totalDepositUsdt, qualifiedReferrals }),
          },
        }),
      ]);
      await notifyVipChanged({
        username: user.username,
        uid: userId,
        oldLevel: user.vipLevel,
        newLevel,
      });
    }
    return newLevel;
  } catch (e) {
    console.error("[vip] recompute failed:", e);
    return null;
  }
}

/**
 * Admin: pin (or clear) a user's VIP level. Pass `null` to clear the override
 * and immediately recompute from live metrics. Records VIPHistory.
 */
export async function setVipOverride(
  userId: string,
  level: number | null,
  adminId: string
): Promise<number> {
  const [user, adminUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { vipLevel: true, username: true } }),
    prisma.user.findUnique({ where: { id: adminId }, select: { username: true } }),
  ]);
  const oldLevel = user?.vipLevel ?? 0;
  const adminName = adminUser?.username ?? "Admin";

  if (level === null) {
    await prisma.user.update({ where: { id: userId }, data: { vipOverride: null } });
    await prisma.vIPHistory.create({
      data: { userId, oldLevel, newLevel: oldLevel, reason: "ADMIN_CLEAR_OVERRIDE", adminId },
    });
    return (await recomputeVipForUser(userId, "AUTO_DEPOSIT")) ?? oldLevel;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { vipOverride: level, vipLevel: level } }),
    prisma.vIPHistory.create({
      data: { userId, oldLevel, newLevel: level, reason: "ADMIN_OVERRIDE", adminId },
    }),
  ]);
  if (level !== oldLevel) {
    await notifyVipChanged({
      username: user?.username ?? "—",
      uid: userId,
      oldLevel,
      newLevel: level,
      admin: adminName,
    });
  }
  return level;
}
