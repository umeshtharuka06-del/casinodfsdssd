/**
 * ───────────────────────────────────────────────────────────────────────────
 *  CRASH ENGINE
 * ───────────────────────────────────────────────────────────────────────────
 *  Pure, side-effect-free crash math, kept separate from the web app exactly
 *  like the prediction engine. The website (src/lib/crash-game.ts) handles the
 *  database/round orchestration and calls into here for every number.
 *
 *  Behaviour:
 *    multiplier(t) = exp(GROWTH_PER_MS * elapsedMs)   (2x ≈ 4.6s, 10x ≈ 15s)
 *  and a bustabit-style provably-fair crash point with a configurable
 *  "instant bust" slice at exactly 1.00x. The instant-bust share defaults to
 *  ~20% (≈1-in-5 rounds) so instant crashes appear naturally and unpredictably
 *  while the remaining rounds keep the original multiplier curve unchanged.
 * ───────────────────────────────────────────────────────────────────────────
 */

import crypto from "crypto";

// Growth rate of the live multiplier. Exposed for callers that animate it.
export const GROWTH_PER_MS = 0.00015;

function hmac(serverSeed: string, message: string): string {
  return crypto.createHmac("sha256", serverSeed).update(message).digest("hex");
}

/** Live multiplier (×100) at `elapsedMs` since the round started running. */
export function multiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return 100;
  const m = Math.exp(GROWTH_PER_MS * elapsedMs) * 100;
  return Math.max(100, Math.floor(m));
}

/** How long (ms) the round runs before it busts at `crashX` (×100). */
export function durationMsForCrash(crashX: number): number {
  if (crashX <= 100) return 0;
  return Math.round(Math.log(crashX / 100) / GROWTH_PER_MS);
}

/**
 * Crash point (×100, e.g. 247 = 2.47x) for a round.
 *
 * `instantCrashPct` is the share of rounds that bust instantly at exactly 1.00x.
 * At the default of 20 this is ~1-in-5 rounds: instant crashes appear naturally
 * and unpredictably (~20% over the long run) with random spacing and never a
 * fixed interval. The outcome is derived only from (serverSeed, clientSeed,
 * period), so every round is fully independent and provably fair — the next
 * instant crash can never be predicted from previous rounds. The remaining
 * ~80% of rounds keep the original bustabit curve (1.10x, 1.25x, 1.80x … 10x,
 * 20x, 50x, 100x+) completely unchanged.
 */
export function crashPoint(
  serverSeed: string,
  clientSeed: string,
  period: bigint | number,
  instantCrashPct = 20
): number {
  const h = hmac(serverSeed, `${clientSeed}:${period.toString()}`);
  // ~1-in-(100/pct) rounds bust at 1.00x. 20% → divisor 5. The divisor is
  // applied to a uniform hash slice, so each round independently lands on the
  // instant-bust slice at the target probability — weighted-random, never on a
  // fixed schedule.
  const instantDivisor = Math.max(1, Math.round(100 / instantCrashPct));
  const e = parseInt(h.slice(0, 8), 16);
  if (e % instantDivisor === 0) return 100; // 1.00x instant bust

  const num = parseInt(h.slice(0, 13), 16);
  const max = Math.pow(2, 52);
  const result = Math.floor((100 * max - num) / (max - num));
  return Math.max(100, result);
}
