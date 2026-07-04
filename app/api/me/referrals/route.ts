import { requireUser } from "@/lib/auth";
import { getReferralSummary } from "@/lib/referral";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// The current user's full referral picture: code, invited/deposited counts,
// pending + claimable + claimed reward balances, reward history, recent invitees.
export async function GET() {
  const user = await requireUser();
  if (!user) return fail("Not authenticated.", 401);

  return ok(await getReferralSummary(user.id));
}
