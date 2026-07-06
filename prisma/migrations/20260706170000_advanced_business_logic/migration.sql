-- Advanced business logic (VIP, casino accounting, referral qualification,
-- withdrawal eligibility, admin notes, daily analytics). Purely additive:
-- new columns on "User" and new tables. No existing column is altered or dropped.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vipLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vipOverride" INTEGER,
ADD COLUMN     "referralAdjustment" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VIPHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldLevel" INTEGER NOT NULL DEFAULT 0,
    "newLevel" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VIPHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedger" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "ref" TEXT,
    "userId" TEXT,
    "note" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetFee" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "feePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawFee" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feeUsdt" DOUBLE PRECISION NOT NULL,
    "feeCoins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralQualification" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "depositId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitSnapshot" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "houseProfit" INTEGER NOT NULL,
    "betFees" INTEGER NOT NULL,
    "withdrawFees" INTEGER NOT NULL,
    "playerLosses" INTEGER NOT NULL,
    "playerWins" INTEGER NOT NULL,
    "referralPaid" INTEGER NOT NULL,
    "vipPaid" INTEGER NOT NULL,
    "manualAdj" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAnalytics" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "depositCount" INTEGER NOT NULL DEFAULT 0,
    "depositCoins" INTEGER NOT NULL DEFAULT 0,
    "withdrawCount" INTEGER NOT NULL DEFAULT 0,
    "withdrawCoins" INTEGER NOT NULL DEFAULT 0,
    "betCount" INTEGER NOT NULL DEFAULT 0,
    "wagered" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VIPHistory_userId_createdAt_idx" ON "VIPHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VIPHistory_createdAt_idx" ON "VIPHistory"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedger_type_createdAt_idx" ON "FinancialLedger"("type", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedger_createdAt_idx" ON "FinancialLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetFee_betId_key" ON "BetFee"("betId");

-- CreateIndex
CREATE INDEX "BetFee_createdAt_idx" ON "BetFee"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawFee_withdrawalId_key" ON "WithdrawFee"("withdrawalId");

-- CreateIndex
CREATE INDEX "WithdrawFee_createdAt_idx" ON "WithdrawFee"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralQualification_referredUserId_key" ON "ReferralQualification"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralQualification_referrerId_status_idx" ON "ReferralQualification"("referrerId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRestriction_userId_createdAt_idx" ON "WithdrawalRestriction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRestriction_createdAt_idx" ON "WithdrawalRestriction"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_userId_createdAt_idx" ON "AdminNote"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitSnapshot_day_key" ON "ProfitSnapshot"("day");

-- CreateIndex
CREATE INDEX "ProfitSnapshot_day_idx" ON "ProfitSnapshot"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAnalytics_day_key" ON "PlatformAnalytics"("day");

-- CreateIndex
CREATE INDEX "PlatformAnalytics_day_idx" ON "PlatformAnalytics"("day");

-- CreateIndex
CREATE INDEX "AuditLog_userId_action_createdAt_idx" ON "AuditLog"("userId", "action", "createdAt");
