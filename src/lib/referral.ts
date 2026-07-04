import { prisma } from "./db";
import { applyBalance, fmtCoins } from "./wallet";
import { getSettingNumber } from "./settings";
import { usdtToCoinCents } from "./crypto/config";

// ────────────────────────────────────────────────────────────────────────────
// Referral rewards.
//
// Rule: when a referred user makes their FIRST successful (approved) deposit,
// the referrer earns a fixed USDT-equivalent reward. The reward is NEVER
// credited straight to the main wallet — it is created PENDING, unlocks after
// a holding period (default 7 days), and the referrer must press "Claim" to
// transfer it into the wallet ledger.
//
// Registration alone grants nothing.
// ────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Called after a deposit has been credited (approveDeposit). If this deposit
 * is the referred user's FIRST approved deposit and they were referred,
 * create the referrer's PENDING reward. Idempotent: the unique constraint on
 * `referredUserId` guarantees at most one reward per referred user even if the
 * poller and an admin approve concurrently. Never touches the main wallet.
 */
export async function grantReferralRewardForDeposit(deposit: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: deposit.userId },
      select: { referredBy: true },
    });
    if (!user?.referredBy) return; // organic signup — nothing to grant

    // First successful deposit only. (The just-approved deposit is already
    // APPROVED at this point, so a count of 1 means "this was the first".)
    const approvedCount = await prisma.deposit.count({
      where: { userId: deposit.userId, status: "APPROVED" },
    });
    if (approvedCount !== 1) return;

    // Self-referral is impossible (referredBy is set once, at registration,
    // before the user could know their own id) but guard anyway.
    if (user.referredBy === deposit.userId) return;

    const [rewardUsdt, lockDays, coinsPerUsdt] = await Promise.all([
      getSettingNumber("referral_reward_usdt"),
      getSettingNumber("referral_lock_days"),
      getSettingNumber("crypto_coins_per_usdt"),
    ]);
    const usdt = rewardUsdt > 0 ? rewardUsdt : 4;
    const days = lockDays > 0 ? lockDays : 7;
    const rate = coinsPerUsdt > 0 ? coinsPerUsdt : 100;

    const now = new Date();
    await prisma.referralReward.create({
      data: {
        referrerId: user.referredBy,
        referredUserId: deposit.userId,
        depositId: deposit.id,
        amount: usdtToCoinCents(usdt, rate),
        amountUsdt: usdt,
        status: "PENDING",
        unlockAt: new Date(now.getTime() + days * DAY_MS),
      },
    });
  } catch (e) {
    // Unique violation = reward already granted (concurrent approval) — fine.
    // Anything else must not break the deposit credit that already happened.
    const code = (e as { code?: string })?.code;
    if (code !== "P2002") console.error("[referral] grant failed:", e);
  }
}

export interface ReferralSummary {
  code: string;
  count: number; // total invited (kept for backward compat)
  depositedCount: number; // invitees with ≥1 approved deposit
  pending: number; // coin-cents still locked
  pendingFmt: string;
  claimable: number; // coin-cents unlocked, awaiting claim
  claimableFmt: string;
  claimed: number; // coin-cents already transferred to the wallet
  claimedFmt: string;
  balance: number; // referral balance = pending + claimable
  balanceFmt: string;
  rewards: Array<{
    id: string;
    username: string; // referred user
    amountFmt: string;
    amountUsdt: number;
    status: "PENDING" | "CLAIMABLE" | "CLAIMED";
    createdAt: string;
    unlockAt: string;
    claimedAt: string | null;
  }>;
  recent: Array<{ username: string; createdAt: string; deposited: boolean }>;
}

/** Full referral stats + reward history for the referral page. */
export async function getReferralSummary(userId: string): Promise<ReferralSummary> {
  const now = Date.now();
  const [count, invitees, rewards] = await Promise.all([
    prisma.user.count({ where: { referredBy: userId } }),
    prisma.user.findMany({
      where: { referredBy: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, username: true, createdAt: true },
    }),
    prisma.referralReward.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const names = new Map(invitees.map((u) => [u.id, u.username]));
  // Usernames for rewarded users who fell outside the recent-50 window.
  const missing = [...new Set(rewards.map((r) => r.referredUserId))].filter(
    (id) => !names.has(id)
  );
  if (missing.length) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, username: true },
    });
    for (const u of extra) names.set(u.id, u.username);
  }

  let pending = 0;
  let claimable = 0;
  let claimed = 0;
  const rewardRows = rewards.map((r) => {
    const status: "PENDING" | "CLAIMABLE" | "CLAIMED" =
      r.status === "CLAIMED"
        ? "CLAIMED"
        : r.unlockAt.getTime() <= now
        ? "CLAIMABLE"
        : "PENDING";
    if (status === "PENDING") pending += r.amount;
    else if (status === "CLAIMABLE") claimable += r.amount;
    else claimed += r.amount;
    return {
      id: r.id,
      username: names.get(r.referredUserId) ?? "—",
      amountFmt: fmtCoins(r.amount),
      amountUsdt: r.amountUsdt,
      status,
      createdAt: r.createdAt.toISOString(),
      unlockAt: r.unlockAt.toISOString(),
      claimedAt: r.claimedAt?.toISOString() ?? null,
    };
  });

  // One reward per referred user, so this IS the deposited-invitee count.
  const rewarded = new Set(rewards.map((r) => r.referredUserId));
  const depositedCount = rewarded.size;

  return {
    code: userId,
    count,
    depositedCount,
    pending,
    pendingFmt: fmtCoins(pending),
    claimable,
    claimableFmt: fmtCoins(claimable),
    claimed,
    claimedFmt: fmtCoins(claimed),
    balance: pending + claimable,
    balanceFmt: fmtCoins(pending + claimable),
    rewards: rewardRows,
    recent: invitees.map((u) => ({
      username: u.username,
      createdAt: u.createdAt.toISOString(),
      deposited: rewarded.has(u.id),
    })),
  };
}

/**
 * Claim every unlocked reward: mark CLAIMED and credit the sum to the main
 * wallet in one transaction. Returns what was credited (0 if nothing was
 * claimable). Safe under concurrency — the updateMany re-checks status inside
 * the transaction, so a double-click can never double-credit.
 */
export async function claimReferralRewards(userId: string): Promise<{
  credited: number;
  creditedFmt: string;
  balance: number;
  balanceFmt: string;
}> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const due = await tx.referralReward.findMany({
      where: { referrerId: userId, status: "PENDING", unlockAt: { lte: now } },
    });
    if (due.length === 0) return { credited: 0, balance: null as number | null };

    const { count } = await tx.referralReward.updateMany({
      where: {
        id: { in: due.map((r) => r.id) },
        status: "PENDING", // re-check inside the tx — no double claim
      },
      data: { status: "CLAIMED", claimedAt: now },
    });
    if (count !== due.length) throw new Error("CLAIM_CONFLICT");

    const total = due.reduce((a, r) => a + r.amount, 0);
    const balance = await applyBalance(tx, userId, total, "REFERRAL_REWARD", undefined, {
      rewards: due.map((r) => r.id),
    });
    return { credited: total, balance };
  });

  const balance =
    result.balance ??
    (await prisma.wallet.findUnique({ where: { userId } }))?.balance ??
    0;
  return {
    credited: result.credited,
    creditedFmt: fmtCoins(result.credited),
    balance,
    balanceFmt: fmtCoins(balance),
  };
}
