import { prisma } from "./db";
import { fmtCoins } from "./wallet";

// ────────────────────────────────────────────────────────────────────────────
// Casino financial analytics (Parts 1, 2, 3).
//
// House-profit accounting (Part 2), the two-sided Financial Overview (Part 1)
// and betting-fee analytics (Part 3). All money is coin-cents (1 coin = 100).
//
// ── House-profit formula (reconciling, no double counting) ──
// In this platform a bet debits the GROSS stake `amount`; the house fee is taken
// from it (effectiveBet = amount − fee) and payouts are computed on effectiveBet,
// so the fee is retained by the house inside the gaming cashflow. Therefore:
//
//   gaming cashflow          = Σ amount − Σ payout            (= W − P)
//                            = betFees + netGamingExclFees
//   netGamingExclFees        = (W − F) − P                    (F = Σ fees)
//   House Profit             = betFees
//                            + max(0, netGamingExclFees)      // net player losses
//                            − max(0, −netGamingExclFees)     // net player winnings
//                            − referralPaid − vipPaid − manualAdj
//                            = (W − P) − referralPaid − vipPaid − manualAdj
//
// This matches the spec's additive intent (Player Losses + Betting Fees −
// Player Winnings − Referral − VIP − Manual) exactly, and is legacy-safe
// (legacy bets have fee 0, so W − F − P degrades to W − P for them).
// ────────────────────────────────────────────────────────────────────────────

const SETTLED = ["WON", "LOST", "CASHED"];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Gaming margin (W − P) over settled bets, optionally since a date. */
async function gamingMargin(since?: Date): Promise<{ wagered: number; payout: number; margin: number }> {
  const agg = await prisma.bet.aggregate({
    _sum: { amount: true, payout: true },
    where: { status: { in: SETTLED }, ...(since ? { createdAt: { gte: since } } : {}) },
  });
  const wagered = agg._sum.amount ?? 0;
  const payout = agg._sum.payout ?? 0;
  return { wagered, payout, margin: wagered - payout };
}

/** Referral rewards actually paid out to wallets (CLAIMED), optionally windowed. */
async function referralPaid(since?: Date): Promise<number> {
  const agg = await prisma.referralReward.aggregate({
    _sum: { amount: true },
    where: { status: "CLAIMED", ...(since ? { claimedAt: { gte: since } } : {}) },
  });
  return agg._sum.amount ?? 0;
}

/** Sum of a FinancialLedger type, optionally windowed. */
async function ledgerSum(type: string, since?: Date): Promise<number> {
  const agg = await prisma.financialLedger.aggregate({
    _sum: { amount: true },
    where: { type, ...(since ? { createdAt: { gte: since } } : {}) },
  });
  return agg._sum.amount ?? 0;
}

export interface HouseProfitBreakdown {
  wagered: number;
  payout: number;
  betFees: number;
  netGamingExclFees: number; // (W − F) − P
  playerLossesNet: number; // max(0, netGamingExclFees)
  playerWinningsNet: number; // max(0, −netGamingExclFees)
  referralPaid: number;
  vipPaid: number;
  manualAdj: number;
  houseProfit: number;
}

/** Full house-profit breakdown for a window (omit `since` for all-time). */
export async function getHouseProfitBreakdown(since?: Date): Promise<HouseProfitBreakdown> {
  const [gm, feeAgg, refPaid, vipPaid, manualAdj] = await Promise.all([
    gamingMargin(since),
    prisma.houseTransaction.aggregate({
      _sum: { fee: true },
      where: since ? { createdAt: { gte: since } } : {},
    }),
    referralPaid(since),
    ledgerSum("VIP_BONUS", since),
    ledgerSum("MANUAL_ADJUSTMENT", since),
  ]);

  const betFees = feeAgg._sum.fee ?? 0;
  const netGamingExclFees = gm.margin - betFees;
  const houseProfit = gm.margin - refPaid - vipPaid - manualAdj;

  return {
    wagered: gm.wagered,
    payout: gm.payout,
    betFees,
    netGamingExclFees,
    playerLossesNet: Math.max(0, netGamingExclFees),
    playerWinningsNet: Math.max(0, -netGamingExclFees),
    referralPaid: refPaid,
    vipPaid,
    manualAdj,
    houseProfit,
  };
}

/** Just the house-profit figure for a window (fast path for the trend cards). */
async function houseProfitValue(since?: Date): Promise<number> {
  const [gm, refPaid, vipPaid, manualAdj] = await Promise.all([
    gamingMargin(since),
    referralPaid(since),
    ledgerSum("VIP_BONUS", since),
    ledgerSum("MANUAL_ADJUSTMENT", since),
  ]);
  return gm.margin - refPaid - vipPaid - manualAdj;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A coin figure with both the raw cents and the formatted string. */
function money(cents: number) {
  return { cents, fmt: fmtCoins(cents) };
}

export interface FinancialOverview {
  breakdown: HouseProfitBreakdown;
  platform: Record<string, { cents: number; fmt: string }>;
  player: Record<string, { cents: number; fmt: string }>;
  playerMeta: {
    pendingDepositsUsdt: number;
    pendingDepositsCount: number;
    pendingWithdrawalsCount: number;
  };
  profit: {
    total: { cents: number; fmt: string };
    today: { cents: number; fmt: string };
    week: { cents: number; fmt: string };
    month: { cents: number; fmt: string };
  };
}

/**
 * The two-sided Financial Overview (Part 1): platform assets vs player assets.
 * Every value is derived from the source-of-truth tables so it is always live.
 */
export async function getFinancialOverview(): Promise<FinancialOverview> {
  const today = startOfToday();
  const week = new Date(Date.now() - 7 * DAY_MS);
  const month = new Date(Date.now() - 30 * DAY_MS);

  const [
    breakdown,
    profitToday,
    profitWeek,
    profitMonth,
    depAgg, // approved deposits
    wdAgg, // completed withdrawals
    walletAgg, // current wallet balances
    pendingDep,
    pendingWd, // held (pending+approved) withdrawals
    lostAgg, // gross losing stakes
    withdrawFeeAgg,
    referralPendingAgg,
  ] = await Promise.all([
    getHouseProfitBreakdown(),
    houseProfitValue(today),
    houseProfitValue(week),
    houseProfitValue(month),
    prisma.deposit.aggregate({ _sum: { coins: true, amountUsdt: true }, where: { status: "APPROVED" } }),
    prisma.withdrawal.aggregate({ _sum: { coins: true }, where: { status: "COMPLETED" } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.deposit.aggregate({ _count: { _all: true }, _sum: { amountUsdt: true }, where: { status: "PENDING" } }),
    prisma.withdrawal.aggregate({
      _count: { _all: true },
      _sum: { coins: true },
      where: { status: { in: ["PENDING", "APPROVED"] } },
    }),
    prisma.bet.aggregate({ _sum: { amount: true }, where: { status: "LOST" } }),
    prisma.withdrawFee.aggregate({ _sum: { feeCoins: true } }),
    prisma.referralReward.aggregate({ _sum: { amount: true }, where: { status: { not: "CLAIMED" } } }),
  ]);

  const deposits = depAgg._sum.coins ?? 0;
  const withdrawals = wdAgg._sum.coins ?? 0;
  const walletBalances = walletAgg._sum.balance ?? 0;
  const heldWithdrawals = pendingWd._sum.coins ?? 0;
  const referralPending = referralPendingAgg._sum.amount ?? 0;

  // House cash = money in − money paid out. Equity = that minus the liability
  // still owed to users (their wallet balances). Locked = coins held for
  // in-flight withdrawals plus referral rewards owed. Available = house cash −
  // locked. All clearly-defined, reconciling figures.
  const houseBalance = deposits - withdrawals;
  const platformEquity = houseBalance - walletBalances;
  const lockedCash = heldWithdrawals + referralPending;
  const availableCash = houseBalance - lockedCash;
  const netRevenue = breakdown.wagered - breakdown.payout; // gaming margin (pre-outflows)

  return {
    breakdown,
    platform: {
      totalProfit: money(breakdown.houseProfit),
      houseBalance: money(houseBalance),
      todaysProfit: money(profitToday),
      weeklyProfit: money(profitWeek),
      monthlyProfit: money(profitMonth),
      totalBettingFees: money(breakdown.betFees),
      totalWithdrawalFees: money(withdrawFeeAgg._sum.feeCoins ?? 0),
      referralCommissionPaid: money(breakdown.referralPaid),
      vipBonusPaid: money(breakdown.vipPaid),
      currentPlatformBalance: money(platformEquity),
      netRevenue: money(netRevenue),
      availableCash: money(availableCash),
      lockedCash: money(lockedCash),
    },
    player: {
      totalDeposits: money(deposits),
      totalWithdrawals: money(withdrawals),
      currentWalletBalances: money(walletBalances),
      pendingDeposits: money(0), // coins are 0 until approved; use count/usdt below
      pendingWithdrawals: money(heldWithdrawals),
      totalBets: money(breakdown.wagered),
      totalWinnings: money(breakdown.payout),
      totalLosses: money(lostAgg._sum.amount ?? 0),
      totalActiveBalance: money(walletBalances),
      referralRewardsPending: money(referralPending),
      vipRewardsPending: money(0), // no pending-VIP accrual model yet
    },
    playerMeta: {
      pendingDepositsUsdt: pendingDep._sum.amountUsdt ?? 0,
      pendingDepositsCount: pendingDep._count._all,
      pendingWithdrawalsCount: pendingWd._count._all,
    },
    profit: {
      total: money(breakdown.houseProfit),
      today: money(profitToday),
      week: money(profitWeek),
      month: money(profitMonth),
    },
  };
}

// ─────────────────────────── Betting fee analytics (Part 3) ─────────────────

export interface FeeAnalytics {
  today: { collected: number; collectedFmt: string; count: number };
  week: { collected: number; collectedFmt: string; count: number };
  month: { collected: number; collectedFmt: string; count: number };
  allTime: { collected: number; collectedFmt: string; count: number };
  feePercent: number | null; // configured percentage, if house fee is percentage-type
  feeType: string;
  averageFee: number; // coin-cents, all time
  averageFeeFmt: string;
  totalWagered: number;
  effectiveFeeRate: number | null; // fees / wagered, as a percentage
}

async function feeWindow(since?: Date) {
  const agg = await prisma.houseTransaction.aggregate({
    _sum: { fee: true },
    _count: { _all: true },
    where: since ? { createdAt: { gte: since } } : {},
  });
  return { collected: agg._sum.fee ?? 0, count: agg._count._all };
}

export async function getFeeAnalytics(): Promise<FeeAnalytics> {
  const today = startOfToday();
  const week = new Date(Date.now() - 7 * DAY_MS);
  const month = new Date(Date.now() - 30 * DAY_MS);

  const [tday, wk, mo, all, wagered, settings] = await Promise.all([
    feeWindow(today),
    feeWindow(week),
    feeWindow(month),
    feeWindow(),
    prisma.bet.aggregate({ _sum: { amount: true }, where: { status: { in: SETTLED } } }),
    prisma.setting.findMany({ where: { key: { in: ["house_fee_type", "house_fee_value"] } } }),
  ]);

  const map = new Map(settings.map((s) => [s.key, s.value]));
  const feeType = map.get("house_fee_type") ?? "percentage";
  const feeValue = Number(map.get("house_fee_value"));
  const feePercent = feeType === "percentage" && Number.isFinite(feeValue) ? feeValue : null;
  const totalWagered = wagered._sum.amount ?? 0;
  const averageFee = all.count > 0 ? Math.round(all.collected / all.count) : 0;
  const effectiveFeeRate = totalWagered > 0 ? +((all.collected / totalWagered) * 100).toFixed(3) : null;

  return {
    today: { ...tday, collectedFmt: fmtCoins(tday.collected) },
    week: { ...wk, collectedFmt: fmtCoins(wk.collected) },
    month: { ...mo, collectedFmt: fmtCoins(mo.collected) },
    allTime: { ...all, collectedFmt: fmtCoins(all.collected) },
    feePercent,
    feeType,
    averageFee,
    averageFeeFmt: fmtCoins(averageFee),
    totalWagered,
    effectiveFeeRate,
  };
}

// ─────────────────────────────── Trends (charts) ────────────────────────────

export interface TrendPoint {
  day: string; // YYYY-MM-DD (UTC)
  value: number; // coins (not cents) for readable chart scales
}

export interface Trends {
  profit: TrendPoint[];
  revenue: TrendPoint[]; // betting-fee income
  deposits: TrendPoint[];
  withdrawals: TrendPoint[];
}

// Zero-filled N-day (UTC) series from pre-aggregated {day, value} rows. Values
// are coin-cents; output is whole coins for readable chart scales.
function fillSeries(rows: Array<{ day: Date; value: number }>, days: number): TrendPoint[] {
  const buckets = new Map<string, number>();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, Math.round(Number(r.value) / 100));
  }
  return [...buckets.entries()].map(([day, value]) => ({ day, value }));
}

/**
 * Daily trend series for the dashboard charts. Aggregation happens in Postgres
 * (date_trunc + SUM) so each series is ~`days` rows regardless of table size —
 * no full-window row scan on the request path. createdAt is stored UTC, so the
 * UTC-day buckets line up with the JS zero-fill.
 */
export async function getTrends(days = 30): Promise<Trends> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  type Row = { day: Date; value: number };
  const [profit, revenue, deposits, withdrawals] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("amount") - SUM("payout"), 0)::float8 AS value
      FROM "Bet" WHERE "createdAt" >= ${since} AND "status" IN ('WON', 'LOST', 'CASHED') GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("fee"), 0)::float8 AS value
      FROM "HouseTransaction" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("coins"), 0)::float8 AS value
      FROM "Deposit" WHERE "createdAt" >= ${since} AND "status" = 'APPROVED' GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT date_trunc('day', "createdAt") AS day, COALESCE(SUM("coins"), 0)::float8 AS value
      FROM "Withdrawal" WHERE "createdAt" >= ${since} AND "status" = 'COMPLETED' GROUP BY 1`,
  ]);

  return {
    profit: fillSeries(profit, days),
    revenue: fillSeries(revenue, days),
    deposits: fillSeries(deposits, days),
    withdrawals: fillSeries(withdrawals, days),
  };
}

// ───────────────────── Daily snapshots / scheduled aggregation ──────────────

/** UTC midnight at the start of the day containing `d`. */
function utcDayStart(d: Date): Date {
  const s = new Date(d);
  s.setUTCHours(0, 0, 0, 0);
  return s;
}

/**
 * Compute and upsert the ProfitSnapshot + PlatformAnalytics rows for the UTC day
 * containing `dayInput` (default: now). Idempotent — safe to re-run for the same
 * day (upsert by `day`), so the scheduler can refresh "today" repeatedly and
 * finalise "yesterday" once. Returns the persisted house-profit figure.
 */
export async function writeDailySnapshot(dayInput?: Date): Promise<{ day: string; houseProfit: number }> {
  const start = utcDayStart(dayInput ?? new Date());
  const end = new Date(start.getTime() + DAY_MS);
  const range = { gte: start, lt: end };

  const [
    betsAgg,
    lostAgg,
    feeAgg,
    withdrawFeeAgg,
    refClaimedAgg,
    vipAgg,
    manualAgg,
    newUsers,
    activeGroups,
    depAgg,
    wdAgg,
    betCount,
  ] = await Promise.all([
    prisma.bet.aggregate({ _sum: { amount: true, payout: true }, where: { status: { in: SETTLED }, createdAt: range } }),
    prisma.bet.aggregate({ _sum: { amount: true }, where: { status: "LOST", createdAt: range } }),
    prisma.houseTransaction.aggregate({ _sum: { fee: true }, where: { createdAt: range } }),
    prisma.withdrawFee.aggregate({ _sum: { feeCoins: true }, where: { createdAt: range } }),
    prisma.referralReward.aggregate({ _sum: { amount: true }, where: { status: "CLAIMED", claimedAt: range } }),
    prisma.financialLedger.aggregate({ _sum: { amount: true }, where: { type: "VIP_BONUS", createdAt: range } }),
    prisma.financialLedger.aggregate({ _sum: { amount: true }, where: { type: "MANUAL_ADJUSTMENT", createdAt: range } }),
    prisma.user.count({ where: { createdAt: range } }),
    prisma.bet.groupBy({ by: ["userId"], where: { createdAt: range } }),
    prisma.deposit.aggregate({ _count: { _all: true }, _sum: { coins: true }, where: { status: "APPROVED", createdAt: range } }),
    prisma.withdrawal.aggregate({ _count: { _all: true }, _sum: { coins: true }, where: { status: "COMPLETED", createdAt: range } }),
    prisma.bet.count({ where: { createdAt: range } }),
  ]);

  const wagered = betsAgg._sum.amount ?? 0;
  const payout = betsAgg._sum.payout ?? 0;
  const betFees = feeAgg._sum.fee ?? 0;
  const withdrawFees = withdrawFeeAgg._sum.feeCoins ?? 0;
  const referralPaid = refClaimedAgg._sum.amount ?? 0;
  const vipPaid = vipAgg._sum.amount ?? 0;
  const manualAdj = manualAgg._sum.amount ?? 0;
  const houseProfit = wagered - payout - referralPaid - vipPaid - manualAdj;

  const profitData = {
    houseProfit,
    betFees,
    withdrawFees,
    playerLosses: lostAgg._sum.amount ?? 0,
    playerWins: payout,
    referralPaid,
    vipPaid,
    manualAdj,
  };
  const analyticsData = {
    newUsers,
    activeUsers: activeGroups.length,
    depositCount: depAgg._count._all,
    depositCoins: depAgg._sum.coins ?? 0,
    withdrawCount: wdAgg._count._all,
    withdrawCoins: wdAgg._sum.coins ?? 0,
    betCount,
    wagered,
    payout,
  };

  await prisma.$transaction([
    prisma.profitSnapshot.upsert({ where: { day: start }, update: profitData, create: { day: start, ...profitData } }),
    prisma.platformAnalytics.upsert({ where: { day: start }, update: analyticsData, create: { day: start, ...analyticsData } }),
  ]);

  return { day: start.toISOString().slice(0, 10), houseProfit };
}

/** Read persisted daily snapshots for the last N days (ascending by day). */
export async function getHistoricalAnalytics(days = 30) {
  const since = utcDayStart(new Date(Date.now() - (days - 1) * DAY_MS));
  const [profit, activity] = await Promise.all([
    prisma.profitSnapshot.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" } }),
    prisma.platformAnalytics.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" } }),
  ]);
  return {
    profit: profit.map((p) => ({
      day: p.day.toISOString().slice(0, 10),
      houseProfit: p.houseProfit,
      houseProfitFmt: fmtCoins(p.houseProfit),
      betFees: p.betFees,
      withdrawFees: p.withdrawFees,
      playerLosses: p.playerLosses,
      playerWins: p.playerWins,
      referralPaid: p.referralPaid,
      vipPaid: p.vipPaid,
      manualAdj: p.manualAdj,
    })),
    activity: activity.map((a) => ({
      day: a.day.toISOString().slice(0, 10),
      newUsers: a.newUsers,
      activeUsers: a.activeUsers,
      depositCount: a.depositCount,
      depositCoins: a.depositCoins,
      withdrawCount: a.withdrawCount,
      withdrawCoins: a.withdrawCoins,
      betCount: a.betCount,
      wagered: a.wagered,
      payout: a.payout,
    })),
  };
}
