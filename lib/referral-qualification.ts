import { prisma } from "./db";

// ────────────────────────────────────────────────────────────────────────────
// Referral qualification (Part 4).
//
// A referral only *counts* once the referred user completes at least one
// APPROVED deposit. Users who merely register never count.
//
// Counts are derived from the source of truth (approved deposits) so they are
// correct even before the ReferralQualification table is backfilled. The table
// is kept in sync going forward and lets an admin explicitly REJECT a referral
// or record the qualifying deposit. The per-user `referralAdjustment` column is
// a manual (+/-) admin correction applied on top of the computed count.
// ────────────────────────────────────────────────────────────────────────────

export interface ReferralQualificationStats {
  invited: number; // everyone who registered under this user
  qualified: number; // invitees with ≥1 approved deposit, not admin-rejected
  pending: number; // invitees with no approved deposit yet, not rejected
  rejected: number; // invitees explicitly rejected by an admin
  adjustment: number; // manual admin +/- correction
  effectiveQualified: number; // qualified + adjustment, floored at 0
}

/** Ensure a PENDING qualification row exists for a freshly-referred user. */
export async function ensureQualificationPending(referredUserId: string, referrerId: string) {
  if (referredUserId === referrerId) return;
  await prisma.referralQualification.upsert({
    where: { referredUserId },
    update: {}, // never downgrade an existing row
    create: { referredUserId, referrerId, status: "PENDING" },
  });
}

/**
 * Mark a referred user's qualification as QUALIFIED on their first approved
 * deposit. Idempotent and safe under concurrency. Never overrides an admin
 * REJECTED decision.
 */
export async function markReferralQualified(referredUserId: string, depositId: string) {
  const user = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;

  await prisma.referralQualification.upsert({
    where: { referredUserId },
    update: {
      // Only promote PENDING → QUALIFIED; leave REJECTED / already-QUALIFIED as-is.
      // (updateMany-style guard via a conditional is not available in upsert, so
      //  we re-read + patch below when needed.)
    },
    create: {
      referredUserId,
      referrerId: user.referredBy,
      status: "QUALIFIED",
      depositId,
      qualifiedAt: new Date(),
    },
  });

  // Promote an existing PENDING row to QUALIFIED (upsert.update above is a no-op
  // for existing rows; do the conditional promotion explicitly).
  await prisma.referralQualification.updateMany({
    where: { referredUserId, status: "PENDING" },
    data: { status: "QUALIFIED", depositId, qualifiedAt: new Date() },
  });
}

/** Admin: set an explicit qualification status for a referred user. */
export async function setReferralQualificationStatus(
  referredUserId: string,
  status: "PENDING" | "QUALIFIED" | "REJECTED"
) {
  const user = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;
  await prisma.referralQualification.upsert({
    where: { referredUserId },
    update: { status, qualifiedAt: status === "QUALIFIED" ? new Date() : null },
    create: {
      referredUserId,
      referrerId: user.referredBy,
      status,
      qualifiedAt: status === "QUALIFIED" ? new Date() : null,
    },
  });
}

/**
 * Full qualified/pending/rejected breakdown for a referrer, computed from
 * approved deposits and reconciled with any admin REJECTED overrides plus the
 * manual adjustment column.
 */
export async function getReferralQualificationStats(
  referrerId: string
): Promise<ReferralQualificationStats> {
  const [invitees, adminRows, referrer] = await Promise.all([
    prisma.user.findMany({ where: { referredBy: referrerId }, select: { id: true } }),
    prisma.referralQualification.findMany({
      where: { referrerId },
      select: { referredUserId: true, status: true },
    }),
    prisma.user.findUnique({ where: { id: referrerId }, select: { referralAdjustment: true } }),
  ]);

  const inviteeIds = invitees.map((u) => u.id);
  const inviteeSet = new Set(inviteeIds);
  const rejected = new Set(
    adminRows.filter((r) => r.status === "REJECTED" && inviteeSet.has(r.referredUserId)).map((r) => r.referredUserId)
  );

  // Invitees with ≥1 approved deposit (the qualifying condition).
  const depositedIds = inviteeIds.length
    ? (
        await prisma.deposit.findMany({
          where: { userId: { in: inviteeIds }, status: "APPROVED" },
          distinct: ["userId"],
          select: { userId: true },
        })
      ).map((d) => d.userId)
    : [];
  const deposited = new Set(depositedIds);

  let qualified = 0;
  let pending = 0;
  for (const id of inviteeIds) {
    if (rejected.has(id)) continue;
    if (deposited.has(id)) qualified++;
    else pending++;
  }

  const adjustment = referrer?.referralAdjustment ?? 0;
  const effectiveQualified = Math.max(0, qualified + adjustment);

  return {
    invited: inviteeIds.length,
    qualified,
    pending,
    rejected: rejected.size,
    adjustment,
    effectiveQualified,
  };
}

/** Convenience: just the effective qualified count (used by VIP + eligibility). */
export async function getEffectiveQualifiedReferrals(referrerId: string): Promise<number> {
  return (await getReferralQualificationStats(referrerId)).effectiveQualified;
}
