import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { processReferralCommissions } from "@/lib/referral-commission";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Generates referral revenue-share commissions from newly-settled bets and
// releases matured (locked) commissions to the referral balance. Idempotent.
//
//   curl -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/referral-commissions
//
// Authorised by CRON_SECRET (header/Bearer) OR an authenticated admin.
async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header =
      req.headers.get("x-cron-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (header && header === secret) return true;
  }
  return !!(await requireAdmin());
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return fail("Forbidden.", 403);
  try {
    const result = await processReferralCommissions();
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Commission processing failed.", 502);
  }
}

export const GET = handle;
export const POST = handle;
