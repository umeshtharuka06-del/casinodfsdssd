import { requireUser } from "@/lib/auth";
import { claimReferralRewards } from "@/lib/referral";
import { ok, fail, handleError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { notifyReferralClaim } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Claim every unlocked referral reward → transfers the sum into the main
// wallet (ledger type REFERRAL_REWARD). Locked rewards stay untouched.
export async function POST() {
  const user = await requireUser();
  if (!user) return fail("Not authenticated.", 401);
  if (!rateLimit(`ref-claim:${user.id}`, 5, 60_000).ok)
    return fail("Too many attempts. Try again shortly.", 429);

  try {
    const res = await claimReferralRewards(user.id);
    if (res.credited === 0)
      return fail("Nothing to claim yet — rewards unlock 7 days after they are earned.", 409);
    await audit("referral.claim", {
      userId: user.id,
      detail: { credited: res.credited },
    });
    await notifyReferralClaim({
      username: user.username,
      uid: user.id,
      coins: res.creditedFmt,
    });
    return ok(res);
  } catch (e) {
    if (e instanceof Error && e.message === "CLAIM_CONFLICT")
      return fail("Claim already in progress — refresh and try again.", 409);
    return handleError(e);
  }
}
