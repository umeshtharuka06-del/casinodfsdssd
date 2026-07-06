import { requireAdmin } from "@/lib/auth";
import { getFinancialOverview, getFeeAnalytics, getTrends } from "@/lib/analytics";
import { fmtCoins } from "@/lib/wallet";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Full casino financial dashboard payload (Parts 1, 2, 3): the two-sided
// overview, the house-profit breakdown, betting-fee analytics and trend series.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const [overview, feeAnalytics, trends] = await Promise.all([
    getFinancialOverview(),
    getFeeAnalytics(),
    getTrends(30),
  ]);
  const breakdown = overview.breakdown; // reuse — avoid recomputing the breakdown

  return ok({
    overview,
    feeAnalytics,
    trends,
    houseProfit: {
      ...breakdown,
      betFeesFmt: fmtCoins(breakdown.betFees),
      playerLossesNetFmt: fmtCoins(breakdown.playerLossesNet),
      playerWinningsNetFmt: fmtCoins(breakdown.playerWinningsNet),
      referralPaidFmt: fmtCoins(breakdown.referralPaid),
      vipPaidFmt: fmtCoins(breakdown.vipPaid),
      manualAdjFmt: fmtCoins(breakdown.manualAdj),
      houseProfitFmt: fmtCoins(breakdown.houseProfit),
    },
  });
}
