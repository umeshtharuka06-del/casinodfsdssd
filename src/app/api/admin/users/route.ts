import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyBalance, COIN, fmtCoins } from "@/lib/wallet";
import { computeUserMetrics } from "@/lib/admin-user-list";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const statusFilter = req.nextUrl.searchParams.get("status") ?? "all"; // all|active|banned|admin
  const vipFilter = Number(req.nextUrl.searchParams.get("vip") ?? "-1"); // -1 = any, else min level
  const format = req.nextUrl.searchParams.get("format"); // "csv" for export

  // Search by username, email, referral code / referral link, or wallet address.
  //  • Referral code IS the user's id; a referral link contains it (…?ref=<id>),
  //    so pull any cuid (25-char, "c"-prefixed) out of the query and match it directly.
  //  • Wallet address → resolve to the users who were assigned that deposit
  //    wallet or who have a deposit request against that address.
  let where: import("@prisma/client").Prisma.UserWhereInput | undefined;
  if (q) {
    const or: import("@prisma/client").Prisma.UserWhereInput[] = [
      { email: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];

    const idMatch = q.match(/c[a-z0-9]{24}/);
    if (idMatch) or.push({ id: idMatch[0] });

    // Wallet-address search: an address looks nothing like an email/username, so
    // only run these extra lookups when the query is address-ish (TRC20 starts
    // with "T" and is 34 chars, but accept any longish alphanumeric token).
    if (/^[a-zA-Z0-9]{6,}$/.test(q)) {
      const [wallets, deposits] = await Promise.all([
        prisma.depositWallet.findMany({
          where: { address: { contains: q, mode: "insensitive" } },
          select: { id: true },
        }),
        prisma.deposit.findMany({
          where: { toAddress: { contains: q, mode: "insensitive" } },
          select: { userId: true },
          take: 200,
        }),
      ]);
      const userIds = new Set(deposits.map((d) => d.userId));
      if (wallets.length) {
        const assigned = await prisma.user.findMany({
          where: { assignedWalletId: { in: wallets.map((w) => w.id) } },
          select: { id: true },
        });
        assigned.forEach((u) => userIds.add(u.id));
      }
      if (userIds.size) or.push({ id: { in: [...userIds] } });
    }

    where = { OR: or };
  }

  // Compose the search with the status / VIP filters (AND).
  const and: import("@prisma/client").Prisma.UserWhereInput[] = [];
  if (where) and.push(where);
  if (statusFilter === "active") and.push({ isBanned: false });
  else if (statusFilter === "banned") and.push({ isBanned: true });
  else if (statusFilter === "admin") and.push({ isAdmin: true });
  if (Number.isFinite(vipFilter) && vipFilter >= 0) and.push({ vipLevel: { gte: vipFilter } });
  const finalWhere = and.length ? { AND: and } : undefined;

  // CSV export streams a larger set; the interactive list is capped at 100.
  const isCsv = format === "csv";
  const users = await prisma.user.findMany({
    where: finalWhere,
    orderBy: { createdAt: "desc" },
    take: isCsv ? 5000 : 100,
    include: { wallet: true },
  });

  const metrics = await computeUserMetrics(users);
  const rows = users.map((u) => {
    const m = metrics.get(u.id);
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      vipLevel: u.vipLevel,
      vipOverride: u.vipOverride,
      qualifiedReferrals: m?.qualifiedReferrals ?? 0,
      totalDeposits: m?.totalDeposits ?? 0,
      totalDepositsFmt: fmtCoins(m?.totalDeposits ?? 0),
      totalWithdrawals: m?.totalWithdrawals ?? 0,
      totalWithdrawalsFmt: fmtCoins(m?.totalWithdrawals ?? 0),
      totalWinnings: m?.totalWinnings ?? 0,
      totalWinningsFmt: fmtCoins(m?.totalWinnings ?? 0),
      totalLoss: m?.totalLoss ?? 0,
      totalLossFmt: fmtCoins(m?.totalLoss ?? 0),
      netGain: m?.netGain ?? 0,
      netGainFmt: fmtCoins(m?.netGain ?? 0),
      balance: u.wallet?.balance ?? 0,
      balanceFmt: fmtCoins(u.wallet?.balance ?? 0),
      lastLogin: m?.lastLogin ?? null,
      referralCode: u.id, // the referral code is the user's id
      referredBy: u.referredBy ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  });

  if (isCsv) {
    const esc = (v: string | number) => {
      let s = String(v);
      // Neutralise spreadsheet formula injection (=, +, -, @, tab, CR leading char).
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Username", "Email", "UserId", "VIP", "QualifiedReferrals", "TotalDeposits",
      "TotalWithdrawals", "TotalWinnings", "TotalLoss", "NetGain", "Balance",
      "LastLogin", "Registered", "Status",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          esc(r.username), esc(r.email), esc(r.id), r.vipLevel, r.qualifiedReferrals,
          esc(r.totalDepositsFmt), esc(r.totalWithdrawalsFmt), esc(r.totalWinningsFmt),
          esc(r.totalLossFmt), esc(r.netGainFmt), esc(r.balanceFmt),
          esc(r.lastLogin ?? "—"), esc(r.createdAt), r.isBanned ? "Banned" : "Active",
        ].join(",")
      );
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return ok(rows);
}

const actionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["ban", "unban", "makeAdmin", "removeAdmin", "credit", "debit"]),
  // coins (whole units) for credit/debit
  amount: z.number().positive().max(1_000_000).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Invalid request.");
  const { userId, action, amount } = parsed.data;

  if (userId === admin.id && (action === "ban" || action === "removeAdmin"))
    return fail("You cannot demote or ban yourself.", 400);

  try {
    switch (action) {
      case "ban":
        await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
        break;
      case "unban":
        await prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
        break;
      case "makeAdmin":
        await prisma.user.update({ where: { id: userId }, data: { isAdmin: true } });
        break;
      case "removeAdmin":
        await prisma.user.update({ where: { id: userId }, data: { isAdmin: false } });
        break;
      case "credit":
        if (!amount) return fail("Amount required.");
        await prisma.$transaction((tx) =>
          applyBalance(tx, userId, amount * COIN, "ADMIN_CREDIT", admin.id)
        );
        break;
      case "debit":
        if (!amount) return fail("Amount required.");
        await prisma.$transaction((tx) =>
          applyBalance(tx, userId, -amount * COIN, "ADMIN_DEBIT", admin.id)
        );
        break;
    }
    await audit(`admin.user.${action}`, { userId: admin.id, detail: { target: userId, amount } });
    return ok({ done: true });
  } catch (e) {
    return handleError(e);
  }
}
