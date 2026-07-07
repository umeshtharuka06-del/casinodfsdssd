// ────────────────────────────────────────────────────────────────────────────
// Referral Commission Worker — independent process.
//
// Runs the existing `processReferralCommissions()` business logic on a loop:
// generates revenue-share commissions from newly-settled referred bets and
// releases matured (locked) commissions to the referral balance. Idempotent, so
// overlap and restarts are safe. Cadence follows REFERRAL_COMMISSION_SECONDS
// (default 3600s = hourly).
// ────────────────────────────────────────────────────────────────────────────
import { processReferralCommissions } from "../lib/referral-commission";
import { prisma } from "../lib/db";
import { startHealthServer, newState } from "./health";

const HEALTH_PORT = Number(process.env.REFERRAL_COMMISSION_HEALTH_PORT) || 4104;
const INTERVAL_SECONDS = Math.max(60, Number(process.env.REFERRAL_COMMISSION_SECONDS) || 3600);

const state = newState("referral-commission");

let busy = false;
let stopped = false;
let timer: NodeJS.Timeout | null = null;

async function cycle() {
  if (busy) return;
  busy = true;
  try {
    const r = await processReferralCommissions();
    state.processed += 1;
    state.lastEventAt = new Date().toISOString();
    if (r.generated || r.released) {
      console.log(`[referral-commission] generated=${r.generated} released=${r.released}`);
    }
  } catch (e) {
    state.errors += 1;
    console.error("[referral-commission] error:", e instanceof Error ? e.message : e);
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
  console.log("[referral-commission] starting");
  startHealthServer(HEALTH_PORT, state);
  void schedule();

  const shutdown = (signal: string) => {
    console.log(`[referral-commission] stopping (${signal})`);
    stopped = true;
    state.running = false;
    if (timer) clearTimeout(timer);
    prisma.$disconnect().catch(() => {});
    setTimeout(() => process.exit(0), 300);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (e) =>
    console.error("[referral-commission] unhandledRejection:", String(e))
  );
}

main().catch((e) => {
  console.error("[referral-commission] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
