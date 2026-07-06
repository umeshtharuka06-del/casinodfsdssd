import { prisma } from "./db";
import { fmtCoins } from "./wallet";
import { getVipContext } from "./vip";
import { getReferralQualificationStats } from "./referral-qualification";
import { tierBenefits } from "./vip-display";

// ────────────────────────────────────────────────────────────────────────────
// Admin — full user detail assembly.
//
// Gathers everything the admin "user details" drawer shows: profile, wallet,
// deposit/withdrawal/bet history, recent logins, and a complete referral picture
// (who invited them, who they invited, reward accounting, and a descendant tree).
// Read-only; no secrets (password hashes, tokens, keys) ever leave this layer.
// ────────────────────────────────────────────────────────────────────────────

const HISTORY_LIMIT = 25;
const TREE_MAX_DEPTH = 6;
const TREE_MAX_NODES = 400;

export interface ReferralTreeNode {
  id: string;
  username: string;
  children: ReferralTreeNode[];
}

/** Build the descendant referral tree rooted at `rootId` (breadth-first, bounded). */
async function buildReferralTree(
  rootId: string,
  rootUsername: string
): Promise<ReferralTreeNode> {
  const root: ReferralTreeNode = { id: rootId, username: rootUsername, children: [] };
  const byId = new Map<string, ReferralTreeNode>([[rootId, root]]);
  let frontier = [rootId];
  let nodeCount = 1;

  for (let depth = 0; depth < TREE_MAX_DEPTH && frontier.length && nodeCount < TREE_MAX_NODES; depth++) {
    const children = await prisma.user.findMany({
      where: { referredBy: { in: frontier } },
      select: { id: true, username: true, referredBy: true },
      orderBy: { createdAt: "asc" },
    });
    if (!children.length) break;
    const next: string[] = [];
    for (const c of children) {
      if (nodeCount >= TREE_MAX_NODES) break;
      const node: ReferralTreeNode = { id: c.id, username: c.username, children: [] };
      byId.set(c.id, node);
      byId.get(c.referredBy!)?.children.push(node);
      next.push(c.id);
      nodeCount++;
    }
    frontier = next;
  }
  return root;
}

export async function getAdminUserDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) return null;

  const [
    deposits,
    withdrawals,
    bets,
    logins,
    referrer,
    invitees,
    rewards,
  ] = await Promise.all([
    prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.auditLog.findMany({
      where: { userId, action: "user.login" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    user.referredBy
      ? prisma.user.findUnique({
          where: { id: user.referredBy },
          select: { id: true, username: true, email: true, createdAt: true },
        })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: { referredBy: userId },
      orderBy: { createdAt: "desc" },
      include: { wallet: true },
    }),
    prisma.referralReward.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // First approved deposit per invitee (for the referred-user table).
  const inviteeIds = invitees.map((u) => u.id);
  const approvedDeposits = inviteeIds.length
    ? await prisma.deposit.findMany({
        where: { userId: { in: inviteeIds }, status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: { userId: true, amountUsdt: true, createdAt: true },
      })
    : [];
  const firstDeposit = new Map<string, { amountUsdt: number; at: string }>();
  for (const d of approvedDeposits) {
    if (!firstDeposit.has(d.userId))
      firstDeposit.set(d.userId, { amountUsdt: d.amountUsdt, at: d.createdAt.toISOString() });
  }

  // Reward accounting: LOCKED (pending, still holding) | AVAILABLE (unlocked,
  // awaiting claim) | CLAIMED. "Pending" = locked + available (not yet claimed).
  const now = Date.now();
  const names = new Map(invitees.map((u) => [u.id, u.username]));
  const missing = [...new Set(rewards.map((r) => r.referredUserId))].filter((id) => !names.has(id));
  if (missing.length) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, username: true },
    });
    for (const u of extra) names.set(u.id, u.username);
  }

  let locked = 0;
  let available = 0;
  let claimed = 0;
  const rewardRows = rewards.map((r) => {
    const status: "LOCKED" | "AVAILABLE" | "CLAIMED" =
      r.status === "CLAIMED"
        ? "CLAIMED"
        : r.unlockAt.getTime() <= now
        ? "AVAILABLE"
        : "LOCKED";
    if (status === "LOCKED") locked += r.amount;
    else if (status === "AVAILABLE") available += r.amount;
    else claimed += r.amount;
    return {
      id: r.id,
      referredUser: names.get(r.referredUserId) ?? "—",
      amountFmt: fmtCoins(r.amount),
      amountUsdt: r.amountUsdt,
      status,
      createdAt: r.createdAt.toISOString(),
      unlockAt: r.unlockAt.toISOString(),
      claimedAt: r.claimedAt?.toISOString() ?? null,
    };
  });

  const rewardedUserIds = new Set(rewards.map((r) => r.referredUserId));
  const depositedUserIds = new Set(approvedDeposits.map((d) => d.userId));
  const successfulCount = depositedUserIds.size;

  const tree = await buildReferralTree(user.id, user.username);

  // Advanced business-logic detail (Part 10): VIP status + history, fee history,
  // withdrawal-restriction history, admin notes, referral qualification stats.
  const [vipCtx, qualStats, vipHistory, feeHistory, restrictions, notes] = await Promise.all([
    getVipContext(userId),
    getReferralQualificationStats(userId),
    prisma.vIPHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT }),
    prisma.houseTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT }),
    prisma.withdrawalRestriction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT }),
    prisma.adminNote.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT }),
  ]);

  return {
    profile: {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    wallet: {
      balance: user.wallet?.balance ?? 0,
      balanceFmt: fmtCoins(user.wallet?.balance ?? 0),
    },
    deposits: deposits.map((d) => ({
      id: d.id,
      amountUsdt: d.amountUsdt,
      coinsFmt: fmtCoins(d.coins),
      status: d.status,
      toAddress: d.toAddress ?? null,
      txid: d.txid ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      coinsFmt: fmtCoins(w.coins),
      usdt: w.usdt,
      receiveUsdt: w.receiveUsdt,
      address: w.address,
      status: w.status,
      txid: w.txid ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
    bets: bets.map((b) => ({
      id: b.id,
      game: b.game,
      selection: b.selection,
      amountFmt: fmtCoins(b.amount),
      status: b.status,
      payoutFmt: fmtCoins(b.payout),
      createdAt: b.createdAt.toISOString(),
    })),
    recentLogins: logins.map((l) => ({
      ip: l.ip ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    referral: {
      code: user.id,
      referredBy: referrer
        ? {
            id: referrer.id,
            username: referrer.username,
            email: referrer.email,
            createdAt: referrer.createdAt.toISOString(),
          }
        : null,
      invitedCount: invitees.length,
      successfulCount,
      rewards: {
        lockedFmt: fmtCoins(locked),
        availableFmt: fmtCoins(available),
        claimedFmt: fmtCoins(claimed),
        pendingFmt: fmtCoins(locked + available),
        history: rewardRows,
      },
      invited: invitees.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        balanceFmt: fmtCoins(u.wallet?.balance ?? 0),
        status: u.isBanned ? "Banned" : "Active",
        firstDepositUsdt: firstDeposit.get(u.id)?.amountUsdt ?? null,
        firstDepositAt: firstDeposit.get(u.id)?.at ?? null,
        deposited: depositedUserIds.has(u.id),
        rewarded: rewardedUserIds.has(u.id),
      })),
      tree,
    },
    vip: {
      level: vipCtx.effectiveLevel,
      computedLevel: vipCtx.computedLevel,
      override: vipCtx.override,
      totalDepositUsdt: vipCtx.totalDepositUsdt,
      qualifiedReferrals: vipCtx.qualifiedReferrals,
      benefits: vipCtx.tier ? tierBenefits(vipCtx.tier) : [],
    },
    referralQualification: {
      invited: qualStats.invited,
      qualified: qualStats.qualified,
      pending: qualStats.pending,
      rejected: qualStats.rejected,
      adjustment: qualStats.adjustment,
      effectiveQualified: qualStats.effectiveQualified,
    },
    vipHistory: vipHistory.map((h) => ({
      id: h.id,
      oldLevel: h.oldLevel,
      newLevel: h.newLevel,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })),
    feeHistory: feeHistory.map((f) => ({
      id: f.id,
      game: f.game,
      feeFmt: fmtCoins(f.fee),
      betId: f.betId,
      createdAt: f.createdAt.toISOString(),
    })),
    restrictions: restrictions.map((r) => ({
      id: r.id,
      reason: r.reason,
      coinsFmt: fmtCoins(r.coins),
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    })),
    adminNotes: notes.map((n) => ({
      id: n.id,
      adminId: n.adminId,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export type AdminUserDetails = NonNullable<Awaited<ReturnType<typeof getAdminUserDetails>>>;
