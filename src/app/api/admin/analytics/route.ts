import { requireAdmin } from "@/lib/auth";
import { getHistoricalAnalytics, writeDailySnapshot } from "@/lib/analytics";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Historical daily analytics (from persisted snapshots).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);
  return ok(await getHistoricalAnalytics(30));
}

// Manually run the daily snapshot (finalise yesterday + refresh today).
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);
  const DAY_MS = 24 * 60 * 60 * 1000;
  try {
    const yesterday = await writeDailySnapshot(new Date(Date.now() - DAY_MS));
    const today = await writeDailySnapshot(new Date());
    await audit("admin.analytics.snapshot", { userId: admin.id, detail: { yesterday, today } });
    return ok({ yesterday, today });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Snapshot failed.", 502);
  }
}
