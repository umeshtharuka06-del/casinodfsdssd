import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyBalance, COIN, fmtCoins } from "@/lib/wallet";
import { ok, fail, handleError } from "@/lib/http";
import { audit } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

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

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { wallet: true },
  });

  return ok(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      balance: u.wallet?.balance ?? 0,
      balanceFmt: fmtCoins(u.wallet?.balance ?? 0),
      referralCode: u.id, // the referral code is the user's id
      referredBy: u.referredBy ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  );
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
