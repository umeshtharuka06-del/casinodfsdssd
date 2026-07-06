-- Off-chain deposit support: how the user says they paid. ONCHAIN transfers are
-- poller-verifiable; OFFCHAIN references always go to manual admin review.
-- Additive only — existing rows default to ONCHAIN (the previous behaviour).

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "txType" TEXT NOT NULL DEFAULT 'ONCHAIN';

-- CreateIndex
CREATE INDEX "Deposit_txType_status_idx" ON "Deposit"("txType", "status");
