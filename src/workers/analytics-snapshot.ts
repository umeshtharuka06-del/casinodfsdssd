// ────────────────────────────────────────────────────────────────────────────
// Analytics Snapshot Worker — independent process.
//
// Periodically writes the daily ProfitSnapshot + PlatformAnalytics rows via the
// existing `writeDailySnapshot()` business logic. It finalises "yesterday" and
// refreshes "today" each cycle; the write is idempotent (upsert by day), so
// overlap and restarts are safe. Cadence follows ANALYTICS_SNAPSHOT_SECONDS
// (default 3600s = hourly), which is plenty for a daily rollup.
// ────────────────────────────────────────────────────────────────────────────
import { writeDailySnapshot } from "../lib/analytics";
import { prisma } from "../lib/db";
import { startHealthServer, newState } from "./health";

const HEALTH_PORT = Number(process.env.ANALYTICS_HEALTH_PORT) || 4103;
const INTERVAL_SECONDS = Math.max(60, Number(process.env.ANALYTICS_SNAPSHOT_SECONDS) || 3600);
const DAY_MS = 24 * 60 * 60 * 1000;

const state = newState("analytics-snapshot");

let busy = false;
let stopped = false;
let timer: NodeJS.Timeout | null = null;

async function cycle() {
  if (busy) return;
  busy = true;
  try {
    await writeDailySnapshot(new Date(Date.now() - DAY_MS)); // finalise yesterday
    const today = await writeDailySnapshot(new Date()); // refresh today
    state.processed += 1;
    state.lastEventAt = new Date().toISOString();
    console.log(`[analytics-snapshot] day=${today.day} houseProfit=${today.houseProfit}`);
  } catch (e) {
    state.errors += 1;
    console.error("[analytics-snapshot] error:", e instanceof Error ? e.message : e);
  } finally {
    busy = false;
  }
}

async function schedule() {
  await cycle();
  if (stopped) return;
  timer = setTimeout(schedule, INTERVAL_SECONDS * 1000);
}

async function main() {
  console.log("[analytics-snapshot] starting");
  startHealthServer(HEALTH_PORT, state);
  void schedule();

  const shutdown = (signal: string) => {
    console.log(`[analytics-snapshot] stopping (${signal})`);
    stopped = true;
    state.running = false;
    if (timer) clearTimeout(timer);
    prisma.$disconnect().catch(() => {});
    setTimeout(() => process.exit(0), 300);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (e) =>
    console.error("[analytics-snapshot] unhandledRejection:", String(e))
  );
}

main().catch((e) => {
  console.error("[analytics-snapshot] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
