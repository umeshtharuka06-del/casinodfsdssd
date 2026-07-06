import { VipTier } from "./business-config";

// Presentation helpers for VIP tiers — shared by the user VIP API and any
// server code that needs human-readable tier descriptions. Kept out of route
// modules (Next.js route files must only export HTTP handlers).

/** Human-readable benefit bullets for a tier (cumulative, per the spec). */
export function tierBenefits(t: VipTier): string[] {
  const bullets: string[] = [];
  if (t.level > 1) bullets.push(`All VIP${t.level - 1} benefits`);
  if (t.signalGroup) bullets.push(`${t.signalGroup} access`);
  if (t.dailySignals > 0) bullets.push(`${t.dailySignals} guaranteed daily signals`);
  if (t.prioritySupport) bullets.push("Priority support");
  if (t.dailyLoginBonusUsdt > 0) bullets.push(`Daily $${t.dailyLoginBonusUsdt} login bonus`);
  return bullets;
}

/** Qualification requirement text for a tier. */
export function tierRequirement(t: VipTier): string {
  const deposit = `Deposit ≥ $${t.minDepositUsdt.toLocaleString()}`;
  return t.minReferrals > 0 ? `${deposit} OR ${t.minReferrals} qualified referrals` : deposit;
}
