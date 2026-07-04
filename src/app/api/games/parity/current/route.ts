import {
  PARITY,
  getCurrentParityRound,
  recentParityRounds,
  parityRoundMs,
} from "@/lib/parity-game";
import { sanitizeRound } from "@/lib/prediction-game";
import { ok, fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// READ-ONLY. Dedicated PARITY round + history feed. Parity intentionally does
// NOT use the shared /api/games/prediction/[mode]/current route — see
// src/lib/parity-game.ts for the ordering rationale. The engine service
// (engine-royal/) creates and settles rounds; this only reads them.
export async function GET() {
  try {
    const roundMs = await parityRoundMs();
    const [round, history] = await Promise.all([
      getCurrentParityRound(),
      recentParityRounds(10),
    ]);
    return ok({
      mode: PARITY,
      roundMs,
      round: round ? sanitizeRound(round, roundMs) : null,
      history,
      serverNow: new Date().toISOString(),
    });
  } catch {
    return fail("Service temporarily unavailable.", 503);
  }
}
