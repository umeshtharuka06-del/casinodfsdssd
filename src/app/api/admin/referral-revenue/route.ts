import { requireAdmin } from "@/lib/auth";
import { getReferralRevenueOverview } from "@/lib/referral-commission";
import { fmtCoins } from "@/lib/wallet";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Admin Referral Revenue overview: pending / released-today / total-paid totals
// plus the top referrers by revenue share.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const o = await getReferralRevenueOverview(30);
  return ok({
    pendingFmt: fmtCoins(o.pending),
    pendingCount: o.pendingCount,
    availableFmt: fmtCoins(o.available),
    availableCount: o.availableCount,
    claimedFmt: fmtCoins(o.claimed),
    totalPaidFmt: fmtCoins(o.totalPaid),
    totalCommissionsFmt: fmtCoins(o.totalCommissions),
    totalHouseFeeFmt: fmtCoins(o.totalHouseFee),
    totalCount: o.totalCount,
    releasedTodayFmt: fmtCoins(o.releasedToday),
    releasedTodayCount: o.releasedTodayCount,
    topReferrers: o.topReferrers.map((r) => ({
      userId: r.userId,
      username: r.username,
      totalFmt: fmtCoins(r.total),
      bets: r.bets,
    })),
  });
}
