import { prisma } from "./db";
import { getBusinessConfig, requiredProfitForDeposit } from "./business-config";
import { getCryptoConfig } from "./crypto/config";
import { getEffectiveQualifiedReferrals } from "./referral-qualification";
import { getTotalApprovedDepositUsdt } from "./vip";

// ────────────────────────────────────────────────────────────────────────────
// Withdrawal limits (Part 8) + eligibility (Part 9).
//
// These are anti-abuse / AML controls. They are TRANSPARENT: the user always
// receives the accurate reason a request was blocked, and every threshold is
// configurable from Admin → Config (nothing hardcoded). Each block is also
// recorded in WithdrawalRestriction so the admin has a searchable history.
// ────────────────────────────────────────────────────────────────────────────

export type RestrictionReason =
  | "MIN_AMOUNT"
  | "FEE_FLOOR"
  | "DAILY_LIMIT"
  | "REFERRAL_QUALIFICATION"
  | "TURNOVER";

export interface EligibilityInput {
  userId: string;
  coinsCents: number; // attempted amount in coin-cents (for the audit record)
  usdt: number; // gross USDT of this request
  feeUsdt: number;
  receiveUsdt: number; // usdt - fee (what the user would receive)
}

export interface EligibilityResult {
  ok: boolean;
  reason?: RestrictionReason;
  /** Accurate, user-facing message (transparent — never a fake generic error). */
  message?: string;
  detail?: Record<string, unknown>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function usdt2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function record(input: EligibilityInput, reason: RestrictionReason, detail: Record<string, unknown>) {
  try {
    await prisma.withdrawalRestriction.create({
      data: {
        userId: input.userId,
        reason,
        coins: input.coinsCents,
        detail: JSON.stringify(detail),
      },
    });
  } catch (e) {
    // Analytics must never block the withdrawal flow.
    console.error("[withdraw-eligibility] restriction log failed:", e);
  }
}

/**
 * Evaluate all configured withdrawal limits and eligibility rules for a request.
 * Returns the first failing rule (with an accurate message) or `{ ok: true }`.
 * Records a WithdrawalRestriction row on any block.
 */
export async function checkWithdrawalEligibility(input: EligibilityInput): Promise<EligibilityResult> {
  // Admin override: this user bypasses ALL withdrawal restrictions (turnover,
  // referral qualification, minimum betting, limits, lock). Everyone else keeps
  // the normal restriction system below.
  const overrideUser = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { manualWithdrawAccess: true, referralRequirementOverride: true },
  });
  if (overrideUser?.manualWithdrawAccess) return { ok: true };
  // Narrower admin override: skip ONLY the minimum-qualified-referrals check.
  // Every other rule below (limits, turnover, etc.) still applies.
  const skipReferralCheck = overrideUser?.referralRequirementOverride === true;

  const [cfg, crypto] = await Promise.all([getBusinessConfig(), getCryptoConfig()]);
  const { withdrawLimits: limits, withdrawEligibility: elig } = cfg;

  // ── Part 8: limits ──
  if (limits.enabled) {
    if (input.usdt < limits.minUsdt) {
      const detail = { requested: input.usdt, minUsdt: limits.minUsdt };
      await record(input, "MIN_AMOUNT", detail);
      return {
        ok: false,
        reason: "MIN_AMOUNT",
        message: `Minimum withdrawal is ${usdt2(limits.minUsdt)} USDT.`,
        detail,
      };
    }

    if (input.receiveUsdt < limits.receiveFloorUsdt) {
      const detail = { receiveUsdt: input.receiveUsdt, floor: limits.receiveFloorUsdt, feeUsdt: input.feeUsdt };
      await record(input, "FEE_FLOOR", detail);
      return {
        ok: false,
        reason: "FEE_FLOOR",
        message: `After the withdrawal fee you must receive at least ${usdt2(limits.receiveFloorUsdt)} USDT.`,
        detail,
      };
    }

    // Rolling 24h total across not-rejected requests (prevents splitting to bypass).
    const since = new Date(Date.now() - DAY_MS);
    const agg = await prisma.withdrawal.aggregate({
      _sum: { usdt: true },
      where: { userId: input.userId, status: { in: ["PENDING", "APPROVED", "COMPLETED"] }, createdAt: { gte: since } },
    });
    const already = agg._sum.usdt ?? 0;
    if (already + input.usdt > limits.dailyMaxUsdt) {
      const remaining = Math.max(0, limits.dailyMaxUsdt - already);
      const detail = { already, requested: input.usdt, dailyMaxUsdt: limits.dailyMaxUsdt, remaining };
      await record(input, "DAILY_LIMIT", detail);
      const tail =
        remaining > 0
          ? `You can withdraw up to ${usdt2(remaining)} USDT more today.`
          : `Please try again later.`;
      return {
        ok: false,
        reason: "DAILY_LIMIT",
        message: `Daily withdrawal limit of ${usdt2(limits.dailyMaxUsdt)} USDT reached. ${tail}`,
        detail,
      };
    }
  }

  // ── Part 9: eligibility ──
  if (elig.enabled) {
    const qualified = await getEffectiveQualifiedReferrals(input.userId);
    if (!skipReferralCheck && qualified < elig.minQualifiedReferrals) {
      const detail = { qualified, required: elig.minQualifiedReferrals };
      await record(input, "REFERRAL_QUALIFICATION", detail);
      return {
        ok: false,
        reason: "REFERRAL_QUALIFICATION",
        message:
          `You need at least ${elig.minQualifiedReferrals} qualified referral(s) to withdraw ` +
          `(you have ${qualified}). A referral qualifies once they complete an approved deposit.`,
        detail,
      };
    }

    const [totalDepositUsdt, betAgg] = await Promise.all([
      getTotalApprovedDepositUsdt(input.userId),
      // Settled bets only — an open (PENDING) bet has its stake debited but no
      // result yet, so including it would understate net profit mid-round.
      prisma.bet.aggregate({
        _sum: { amount: true, payout: true },
        where: { userId: input.userId, status: { in: ["WON", "LOST", "CASHED"] } },
      }),
    ]);
    const netProfitCents = (betAgg._sum.payout ?? 0) - (betAgg._sum.amount ?? 0);
    const netProfitUsdt = netProfitCents / 100 / crypto.coinsPerUsdt;
    const requiredProfitUsdt = requiredProfitForDeposit(totalDepositUsdt, elig.profitTiers);

    if (netProfitUsdt < requiredProfitUsdt) {
      const detail = { netProfitUsdt, requiredProfitUsdt, totalDepositUsdt };
      await record(input, "TURNOVER", detail);
      return {
        ok: false,
        reason: "TURNOVER",
        message:
          `You need at least ${usdt2(requiredProfitUsdt)} USDT net betting profit before withdrawing ` +
          `(your current net profit is ${usdt2(netProfitUsdt)} USDT).`,
        detail,
      };
    }
  }

  return { ok: true };
}
