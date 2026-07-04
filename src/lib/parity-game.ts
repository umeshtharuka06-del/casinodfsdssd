import { prisma } from "./db";
import { getSettingNumber } from "./settings";
import { sanitizeRound, type SanitizedRound } from "./prediction-game";

// ─────────────────────────────────────────────────────────────────────────────
// PARITY — dedicated read-only data flow (current round + settled history).
//
// Rebuilt 2026-07 on the same architecture as the working prediction modes
// (engine-royal creates/settles rounds; the website only reads and bets). The
// one deliberate difference is HOW the history window is selected:
//
//   • History is ordered by CANONICAL PERIOD (period desc) — true round order,
//     so it is monotonic newest-first and NEVER reshuffles when a round settles
//     late. Two foreign-cadence hazards are excluded up front instead:
//
//       – Foreign rounds from a SHORTER cadence carry a period LARGER than the
//         live stream ever produces (period = startMs / roundMs). They are cut
//         with a `period <= currentPeriod` filter so they can't pin the top.
//
//       – Foreign / imported rounds from any other cadence are cut with a
//         canonical-cadence guard: a live round always satisfies
//         floor(startAt / liveRoundMs) === period, so any row that doesn't is
//         dropped.
//
//     An earlier revision ordered by `settledAt desc` to dodge the first hazard,
//     but that let a foreign round which settles LATE (recovery/backfill stamps
//     a fresh settledAt) leap to the top of history and hide the true newest
//     round. Ordering by period + excluding foreign rows fixes both directions.
//
//   • The window is deduped by canonical period server-side, so the API can
//     never hand the client two rows for one displayed period.
//
// This module performs no writes. Round creation and settlement live only in
// the engine service (engine-royal/); bets keep using the shared bet route.
// ─────────────────────────────────────────────────────────────────────────────

export const PARITY = "PARITY" as const;

const ROUND_SECONDS_KEY = "parity_round_seconds";
const DEFAULT_ROUND_SECONDS = 180;

export async function parityRoundMs(): Promise<number> {
  const seconds =
    (await getSettingNumber(ROUND_SECONDS_KEY)) || DEFAULT_ROUND_SECONDS;
  return seconds * 1000;
}

/** READ-ONLY: the round for the current wall-clock period, or null if the engine has not opened it yet. */
export async function getCurrentParityRound() {
  const period = BigInt(Math.floor(Date.now() / (await parityRoundMs())));
  return prisma.gameRound.findUnique({
    where: { game_period: { game: PARITY, period } },
  });
}

/** Most recently SETTLED Parity rounds — true newest-first by period, deduped. */
export async function recentParityRounds(limit = 10): Promise<SanitizedRound[]> {
  const roundMs = await parityRoundMs();
  // The current wall-clock period. Settled rounds are always at or below it;
  // foreign rounds from a shorter cadence sit far above it and are excluded.
  const currentPeriod = BigInt(Math.floor(Date.now() / roundMs));
  // Over-fetch so the dedupe + cadence guard cannot shrink the window below `limit`.
  const rows = await prisma.gameRound.findMany({
    where: { game: PARITY, state: "SETTLED", period: { lte: currentPeriod } },
    orderBy: { period: "desc" },
    take: limit + 10,
  });
  const seen = new Set<string>();
  const out: SanitizedRound[] = [];
  for (const r of rows) {
    // Canonical-cadence guard: reject any row whose stored period doesn't match
    // the period the LIVE cadence would assign to its startAt (foreign/imported
    // rounds created under a different round length). A genuine live round always
    // satisfies floor(startAt / roundMs) === period.
    if (Math.floor(r.startAt.getTime() / roundMs) !== Number(r.period)) continue;
    const key = r.period.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sanitizeRound(r, roundMs));
    if (out.length >= limit) break;
  }
  return out;
}
