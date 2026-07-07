import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/http";
import { getAdminUserDetails } from "@/lib/admin-user";
import { setVipOverride, recomputeVipForUser } from "@/lib/vip";
import { setReferralQualificationStatus } from "@/lib/referral-qualification";
import { isPlausibleUserId } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Full details for one user (profile, wallet, histories, referral tree). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const { id } = await ctx.params;
  if (!isPlausibleUserId(id)) return fail("Invalid user id.", 400);

  const details = await getAdminUserDetails(id);
  if (!details) return fail("User not found.", 404);
  return ok(details);
}

// Per-user admin actions (Part 10): manual VIP override, manual referral
// adjustment, admin notes, and referral-qualification status changes. All are
// audited and, where relevant, trigger a VIP recompute.
const actionSchema = z.object({
  action: z.enum(["vipOverride", "referralAdjust", "addNote", "qualificationStatus", "withdrawAccess"]),
  level: z.number().int().min(0).max(10).nullable().optional(),
  adjustment: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  body: z.string().trim().min(1).max(1000).optional(),
  referredUserId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "QUALIFIED", "REJECTED"]).optional(),
  enabled: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return fail("User not found.", 404);

  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Invalid request.");
  const { action, level, adjustment, body, referredUserId, status, enabled } = parsed.data;

  try {
    switch (action) {
      case "withdrawAccess": {
        if (enabled === undefined) return fail("Provide enabled (true/false).");
        await prisma.user.update({ where: { id }, data: { manualWithdrawAccess: enabled } });
        const u = await prisma.user.findUnique({ where: { id }, select: { username: true } });
        await audit(enabled ? "admin.user.withdrawAccess.enable" : "admin.user.withdrawAccess.disable", {
          userId: admin.id,
          ip: clientIp(req),
          detail: { target: id, username: u?.username, enabled },
        });
        return ok({ manualWithdrawAccess: enabled });
      }
      case "vipOverride": {
        if (level === undefined) return fail("Provide a level (or null to clear).");
        const newLevel = await setVipOverride(id, level, admin.id);
        await audit("admin.user.vipOverride", { userId: admin.id, detail: { target: id, level } });
        return ok({ level: newLevel });
      }
      case "referralAdjust": {
        if (adjustment === undefined) return fail("Provide an adjustment amount.");
        await prisma.user.update({ where: { id }, data: { referralAdjustment: adjustment } });
        // The referrer's own qualified-referral count changed → recompute VIP.
        await recomputeVipForUser(id, "AUTO_REFERRAL");
        await audit("admin.user.referralAdjust", { userId: admin.id, detail: { target: id, adjustment } });
        return ok({ adjustment });
      }
      case "addNote": {
        if (!body) return fail("Note body required.");
        const note = await prisma.adminNote.create({ data: { userId: id, adminId: admin.id, body } });
        await audit("admin.user.note", { userId: admin.id, detail: { target: id, noteId: note.id } });
        return ok({ id: note.id });
      }
      case "qualificationStatus": {
        if (!referredUserId || !status) return fail("referredUserId and status required.");
        await setReferralQualificationStatus(referredUserId, status);
        await recomputeVipForUser(id, "AUTO_REFERRAL"); // referrer count may change
        await audit("admin.user.qualificationStatus", {
          userId: admin.id,
          detail: { referrer: id, referredUserId, status },
        });
        return ok({ referredUserId, status });
      }
    }
  } catch (e) {
    return handleError(e);
  }
}
