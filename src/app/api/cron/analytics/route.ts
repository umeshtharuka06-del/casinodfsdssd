import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { writeDailySnapshot } from "@/lib/analytics";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Writes the daily platform-analytics snapshots. Idempotent, so run it as often
// as you like: it refreshes "today" and finalises "yesterday".
//
//   curl -H "x-cron-secret: $CRON_SECRET" https://<site>/api/cron/analytics
//
// Authorised by CRON_SECRET (header or Bearer), OR an authenticated admin so it
// can be triggered manually from the panel.
const DAY_MS = 24 * 60 * 60 * 1000;

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
    // Finalise yesterday, then refresh today.
    const yesterday = await writeDailySnapshot(new Date(Date.now() - DAY_MS));
    const today = await writeDailySnapshot(new Date());
    return ok({ yesterday, today });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Snapshot failed.", 502);
  }
}

export const GET = handle;
export const POST = handle;
