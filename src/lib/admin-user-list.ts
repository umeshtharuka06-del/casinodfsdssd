import { prisma } from "./db";

// ────────────────────────────────────────────────────────────────────────────
// Admin user-list metrics (Part 7).
//
// Computes the per-user financial/VIP/referral columns for the user table in a
// batched, N+1-free way (a handful of groupBy queries regardless of row count).
// Qualified referrals mirror lib/referral-qualification.ts: invitees with an
// approved deposit, minus admin REJECTED, plus the manual adjustment.
// ────────────────────────────────────────────────────────────────────────────

const SETTLED = ["WON", "LOST", "CASHED"];

export interface UserMetrics {
  qualifiedReferrals: number;
  totalDeposits: number; // coin-cents, approved
  totalWithdrawals: number; // coin-cents, completed
  totalWinnings: number; // coin-cents, Σ payout (settled)
  totalLoss: number; // coin-cents, Σ stake on LOST bets
  netGain: number; // coin-cents, Σ payout − Σ stake (user P/L)
  lastLogin: string | null;
}

export async function computeUserMetrics(
  users: { id: string; referralAdjustment: number }[]
): Promise<Map<string, UserMetrics>> {
  const out = new Map<string, UserMetrics>();
  const ids = users.map((u) => u.id);
  if (!ids.length) return out;
  const adjustment = new Map(users.map((u) => [u.id, u.referralAdjustment]));

  const [deps, wds, betsAll, betsLost, logins, invitees, rejected] = await Promise.all([
    prisma.deposit.groupBy({ by: ["userId"], _sum: { coins: true }, where: { userId: { in: ids }, status: "APPROVED" } }),
    prisma.withdrawal.groupBy({ by: ["userId"], _sum: { coins: true }, where: { userId: { in: ids }, status: "COMPLETED" } }),
    prisma.bet.groupBy({ by: ["userId"], _sum: { amount: true, payout: true }, where: { userId: { in: ids }, status: { in: SETTLED } } }),
    prisma.bet.groupBy({ by: ["userId"], _sum: { amount: true }, where: { userId: { in: ids }, status: "LOST" } }),
    prisma.auditLog.groupBy({ by: ["userId"], _max: { createdAt: true }, where: { userId: { in: ids }, action: "user.login" } }),
    prisma.user.findMany({ where: { referredBy: { in: ids } }, select: { id: true, referredBy: true } }),
    prisma.referralQualification.findMany({
      where: { referrerId: { in: ids }, status: "REJECTED" },
      select: { referredUserId: true, referrerId: true },
    }),
  ]);

  // Which invitees have completed an approved deposit → they qualify.
  const inviteeIds = invitees.map((i) => i.id);
  const depositedInvitees = inviteeIds.length
    ? new Set(
        (
          await prisma.deposit.findMany({
            where: { userId: { in: inviteeIds }, status: "APPROVED" },
            distinct: ["userId"],
            select: { userId: true },
          })
        ).map((d) => d.userId)
      )
    : new Set<string>();

  // Rejected referred-users per referrer.
  const rejectedByRef = new Map<string, Set<string>>();
  for (const r of rejected) {
    if (!rejectedByRef.has(r.referrerId)) rejectedByRef.set(r.referrerId, new Set());
    rejectedByRef.get(r.referrerId)!.add(r.referredUserId);
  }

  // Qualified count per referrer.
  const qualified = new Map<string, number>();
  for (const inv of invitees) {
    const ref = inv.referredBy!;
    if (rejectedByRef.get(ref)?.has(inv.id)) continue;
    if (depositedInvitees.has(inv.id)) qualified.set(ref, (qualified.get(ref) ?? 0) + 1);
  }

  const depMap = new Map(deps.map((d) => [d.userId, d._sum.coins ?? 0]));
  const wdMap = new Map(wds.map((w) => [w.userId, w._sum.coins ?? 0]));
  const betAllMap = new Map(betsAll.map((b) => [b.userId, { amount: b._sum.amount ?? 0, payout: b._sum.payout ?? 0 }]));
  const lostMap = new Map(betsLost.map((b) => [b.userId, b._sum.amount ?? 0]));
  const loginMap = new Map(logins.map((l) => [l.userId, l._max.createdAt]));

  for (const id of ids) {
    const bet = betAllMap.get(id) ?? { amount: 0, payout: 0 };
    const last = loginMap.get(id);
    out.set(id, {
      qualifiedReferrals: Math.max(0, (qualified.get(id) ?? 0) + (adjustment.get(id) ?? 0)),
      totalDeposits: depMap.get(id) ?? 0,
      totalWithdrawals: wdMap.get(id) ?? 0,
      totalWinnings: bet.payout,
      totalLoss: lostMap.get(id) ?? 0,
      netGain: bet.payout - bet.amount,
      lastLogin: last ? last.toISOString() : null,
    });
  }
  return out;
}
