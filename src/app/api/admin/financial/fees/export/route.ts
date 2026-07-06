import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtCoins } from "@/lib/wallet";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// CSV export of collected betting fees (Part 3). Optional ?days=N window
// (default all-time). Streams a downloadable text/csv attachment.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const where =
    Number.isFinite(daysParam) && daysParam > 0
      ? { createdAt: { gte: new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000) } }
      : {};

  const rows = await prisma.houseTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50_000, // hard cap so the export can never run unbounded
  });

  // Attach usernames without a relation join.
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, username: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.username]));

  const esc = (v: string | number) => {
    let s = String(v);
    // Neutralise spreadsheet formula injection (=, +, -, @, tab, CR leading char).
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ["Date", "User", "UserId", "Game", "BetId", "FeeCoins"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        esc(r.createdAt.toISOString()),
        esc(nameOf.get(r.userId) ?? "—"),
        esc(r.userId),
        esc(r.game),
        esc(r.betId),
        esc(fmtCoins(r.fee)),
      ].join(",")
    );
  }
  const csv = lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="betting-fees-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
