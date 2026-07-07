import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyBalance, COIN, fmtCoins } from "@/lib/wallet";
import { isPlausibleUserId, firstError } from "@/lib/validation";
import { ok, fail, handleError } from "@/lib/http";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { notifyBalanceAdjust } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// Admin manual wallet adjustment — add / remove coins from a user's wallet.
//   POST /api/admin/users/:id/wallet   { amount: 500, action: "ADD", reason: "Promotion" }
//
// Reuses the shared applyBalance service for the balance mutation (writes the
// ADMIN_CREDIT / ADMIN_DEBIT ledger row and refuses to go negative), then
// records a WalletTransaction (admin audit) and an AuditLog. Admin-only,
// validated and rate-limited.
const bodySchema = z.object({
  amount: z.number().int("Amount must be a whole number.").positive("Amount must be positive.").max(10_000_000),
  action: z.enum(["ADD", "REMOVE"]),
  reason: z.string().trim().min(1, "A reason is required.").max(300),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  if (!rateLimit(`admin-wallet:${admin.id}`, 30, 60_000).ok)
    return fail("Too many adjustments. Try again in a moment.", 429);

  const { id } = await ctx.params;
  if (!isPlausibleUserId(id)) return fail("Invalid user id.", 400);

  const target = await prisma.user.findUnique({ where: { id }, select: { username: true } });
  if (!target) return fail("User not found.", 404);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { amount, action, reason } = parsed.data;

  const cents = amount * COIN;
  const signed = action === "ADD" ? cents : -cents;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: id } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");
      const balanceBefore = wallet.balance;
      // applyBalance throws INSUFFICIENT_FUNDS if a removal would go negative.
      const balanceAfter = await applyBalance(
        tx,
        id,
        signed,
        action === "ADD" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
        undefined,
        { reason, adjustedBy: admin.id, kind: "admin-wallet-adjust" }
      );
      await tx.walletTransaction.create({
        data: { userId: id, adminId: admin.id, amount: cents, type: action, reason, balanceBefore, balanceAfter },
      });
      return { balanceBefore, balanceAfter };
    });

    await audit(`admin.wallet.${action.toLowerCase()}`, {
      userId: admin.id,
      ip: clientIp(req),
      detail: {
        target: id,
        username: target.username,
        amountCoins: amount,
        reason,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
      },
    });

    // Reuse the existing operator notification for manual balance changes.
    await notifyBalanceAdjust({
      username: target.username,
      uid: id,
      direction: action === "ADD" ? "credit" : "debit",
      coins: fmtCoins(cents),
      admin: admin.username,
    });

    return ok({
      balance: result.balanceAfter,
      balanceFmt: fmtCoins(result.balanceAfter),
      type: action,
      amountFmt: fmtCoins(cents),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_FUNDS")
      return fail("Removal exceeds the user's current balance.", 400, "INSUFFICIENT_FUNDS");
    return handleError(e);
  }
}
