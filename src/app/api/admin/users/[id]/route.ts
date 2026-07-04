import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { getAdminUserDetails } from "@/lib/admin-user";

export const dynamic = "force-dynamic";

/** Full details for one user (profile, wallet, histories, referral tree). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Forbidden.", 403);

  const { id } = await ctx.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return fail("Invalid user id.", 400);

  const details = await getAdminUserDetails(id);
  if (!details) return fail("User not found.", 404);
  return ok(details);
}
