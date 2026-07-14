-- Admin per-user override that bypasses ONLY the minimum-qualified-referrals
-- withdrawal check. All other withdrawal restrictions stay enforced. Additive.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralRequirementOverride" BOOLEAN NOT NULL DEFAULT false;
