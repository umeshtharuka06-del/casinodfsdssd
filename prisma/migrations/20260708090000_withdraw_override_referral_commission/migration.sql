-- Feature 1: admin manual withdrawal-access override (per-user bypass of all
-- withdrawal restrictions). Feature 2: referral revenue-share commissions
-- (referrer earns a % of the house fee on referred users' settled bets).
-- Both additive.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "manualWithdrawAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "houseFee" INTEGER NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_betId_key" ON "ReferralCommission"("betId");

-- CreateIndex
CREATE INDEX "ReferralCommission_ownerUserId_status_idx" ON "ReferralCommission"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "ReferralCommission_ownerUserId_createdAt_idx" ON "ReferralCommission"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralCommission_status_availableAt_idx" ON "ReferralCommission"("status", "availableAt");
