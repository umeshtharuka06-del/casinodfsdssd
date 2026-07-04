import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { forceResultSchema, firstError } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { formatRoundId } from "@/lib/round-id";
import { COIN } from "@/lib/wallet";

export const dynamic = "force-dynamic";

// Only the four prediction games are forceable. COLOR/NUMBER are retired.
const FORCEABLE_GAMES = ["PARITY", "SAPRE", "BCONE", "EMERD"] as const;
const COLORS = ["RED", "GREEN", "VIOLET"] as const;

interface SideStat {
  coins: number; // total staked on this side, in whole coins
  players: number; // distinct users backing this side
}
function emptyStat(): SideStat {
  return { coins: 0, players: 0 };
}

/**
 * List the not-yet-settled prediction rounds an admin can force, each with a
 * LIVE betting breakdown (player count, total staked, per-colour and per-digit
 * totals + distinct backers). While a round is open the numbers grow with every
 * bet; once betting closes no further bets are accepted, so the figures returned
 * here are the frozen final tally for that round.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const rounds = await prisma.gameRound.findMany({
    where: {
      game: { in: [...FORCEABLE_GAMES] },
      state: { not: "SETTLED" },
    },
    orderBy: [{ game: "asc" }, { period: "desc" }],
    take: 20,
    include: { _count: { select: { bets: true } } },
  });

  // Pull every bet for the listed rounds in one query and aggregate in memory.
  // Betting windows are short, so the per-round bet volume is small.
  const roundIds = rounds.map((r) => r.id);
  const bets = roundIds.length
    ? await prisma.bet.findMany({
        where: { roundId: { in: roundIds } },
        select: { roundId: true, userId: true, selection: true, amount: true },
      })
    : [];

  // roundId → aggregate accumulator.
  const agg = new Map<
    string,
    {
      players: Set<string>;
      totalCents: number;
      colors: Record<string, { cents: number; users: Set<string> }>;
      digits: Record<string, { cents: number; users: Set<string> }>;
    }
  >();
  const seed = () => ({
    players: new Set<string>(),
    totalCents: 0,
    colors: Object.fromEntries(COLORS.map((c) => [c, { cents: 0, users: new Set<string>() }])),
    digits: Object.fromEntries(
      Array.from({ length: 10 }, (_, d) => [String(d), { cents: 0, users: new Set<string>() }])
    ),
  });
  for (const id of roundIds) agg.set(id, seed());

  for (const b of bets) {
    const a = agg.get(b.roundId);
    if (!a) continue;
    a.players.add(b.userId);
    a.totalCents += b.amount;
    if (b.selection in a.colors) {
      a.colors[b.selection].cents += b.amount;
      a.colors[b.selection].users.add(b.userId);
    } else if (b.selection in a.digits) {
      a.digits[b.selection].cents += b.amount;
      a.digits[b.selection].users.add(b.userId);
    }
  }

  const now = Date.now();
  return ok(
    rounds.map((r) => {
      const a = agg.get(r.id)!;
      const colors: Record<string, SideStat> = {};
      for (const c of COLORS)
        colors[c] = { coins: a.colors[c].cents / COIN, players: a.colors[c].users.size };
      const digits: Record<string, SideStat> = {};
      for (let d = 0; d < 10; d++) {
        const s = a.digits[String(d)];
        digits[String(d)] = { coins: s.cents / COIN, players: s.users.size };
      }
      return {
        id: r.id,
        roundId: formatRoundId(r.game, r.period),
        game: r.game,
        state: r.state,
        bets: r._count.bets,
        forcedResult: r.forcedResult ? JSON.parse(r.forcedResult) : null,
        startAt: r.startAt.toISOString(),
        lockAt: r.lockAt.toISOString(),
        settleAt: r.settleAt.toISOString(),
        // Live betting summary. `frozen` once betting has closed for the round.
        stats: {
          players: a.players.size,
          totalCoins: a.totalCents / COIN,
          colors,
          digits,
          frozen: now >= r.lockAt.getTime(),
        },
      };
    })
  );
}

/**
 * Force the outcome of a not-yet-settled prediction round.
 * Body: { roundId, game: "PARITY"|"SAPRE"|"BCONE"|"EMERD", color?, digit? }
 * The prediction engine reads this at settlement and uses it verbatim.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const parsed = forceResultSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { roundId, game, color, digit } = parsed.data;

  if (!(FORCEABLE_GAMES as readonly string[]).includes(game))
    return fail("Only Parity, Sapre, Bcone and Emerd rounds can be forced.", 400);
  if (color == null && digit == null)
    return fail("Provide a color or a digit (0-9) to force.");

  const round = await prisma.gameRound.findUnique({ where: { id: roundId } });
  if (!round) return fail("Round not found.", 404);
  if (round.game !== game) return fail("Round/game mismatch.", 400);
  if (round.state === "SETTLED")
    return fail("That round is already settled.", 409);

  // A digit choice takes precedence; both colour and number bets settle from the
  // drawn digit, so forcing a digit is the most specific override.
  const forced = digit != null ? { digit } : { color };

  await prisma.gameRound.update({
    where: { id: roundId },
    data: { forcedResult: JSON.stringify(forced) },
  });
  await audit("admin.game.force", {
    userId: admin.id,
    detail: { roundId, game, forced },
  });

  return ok({ roundId, forced });
}

/** Clear a previously-set forced result, returning the round to the engine. */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const roundId = req.nextUrl.searchParams.get("roundId");
  if (!roundId) return fail("roundId required.");

  await prisma.gameRound.update({
    where: { id: roundId },
    data: { forcedResult: null },
  });
  await audit("admin.game.force.clear", { userId: admin.id, detail: { roundId } });
  return ok({ roundId, cleared: true });
}
