-- ─────────────────────────────────────────────────────────────────────────────
-- IMMEDIATE PRODUCTION HOTFIX — Deposit P2022 ("column Deposit.txType does not
-- exist"). Root cause: the additive migration 20260707090000_deposit_tx_type
-- was never applied to the production database, so the Prisma Client (which
-- knows txType from the schema) issues INSERT/SELECT with a column the DB lacks.
--
-- PREFERRED FIX (keeps Prisma migration history consistent):
--   docker compose run --rm --no-deps web npx prisma migrate deploy
--   (or: bash deploy/deploy.sh)
--
-- If you cannot run migrate deploy right now, apply this SQL directly against the
-- production database (idempotent — safe to run more than once):
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "txType" TEXT NOT NULL DEFAULT 'ONCHAIN';
CREATE INDEX IF NOT EXISTS "Deposit_txType_status_idx" ON "Deposit"("txType", "status");

-- After running the SQL directly, tell Prisma the migration is applied so a later
-- `migrate deploy` doesn't try to re-run it:
--   npx prisma migrate resolve --applied 20260707090000_deposit_tx_type
--
-- NOTE: `Deposit.txHash` does NOT exist anywhere in this codebase or schema — the
-- only column that was missing is `txType`. No other Deposit columns are missing
-- (the 0_init baseline already contains toAddress, txid, fromAddress, etc.).
