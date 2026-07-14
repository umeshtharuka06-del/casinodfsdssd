import { z } from "zod";
import { isValidTronAddress } from "./crypto/address";

const tronAddress = z
  .string()
  .trim()
  .refine((a) => isValidTronAddress(a), "Enter a valid TRC20 (TRON) address.");

/** User withdrawal request. `coins` is whole coins (the UI unit). */
export const cryptoWithdrawSchema = z.object({
  address: tronAddress,
  coins: z.number().int().positive().max(100_000_000),
});

/** User deposit request — "I Have Paid".
 *  ONCHAIN: `txid` (the on-chain transaction hash) is REQUIRED.
 *  OFFCHAIN: `txid` (the internal/exchange reference) is REQUIRED — it cannot be
 *  chain-verified, so the request always goes to manual admin review. */
export const cryptoDepositSchema = z
  .object({
    amountUsdt: z.number().positive().max(1_000_000),
    txType: z.enum(["ONCHAIN", "OFFCHAIN"]).default("ONCHAIN"),
    txid: z.string().trim().max(120).optional(),
  })
  .refine((d) => d.txType !== "OFFCHAIN" || (d.txid && d.txid.length >= 6), {
    message: "Enter the off-chain transaction reference so our team can verify it.",
    path: ["txid"],
  })
  .refine((d) => d.txType !== "ONCHAIN" || (d.txid && d.txid.length > 0), {
    message: "Transaction ID is required.",
    path: ["txid"],
  });

/** Admin action on a deposit request. */
export const adminDepositActionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  txid: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Create / update a managed deposit wallet. */
export const depositWalletSchema = z.object({
  name: z.string().trim().min(1).max(60),
  address: tronAddress,
  network: z.string().trim().min(1).max(20).default("TRC20"),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
});

export const depositWalletUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  address: tronAddress.optional(),
  network: z.string().trim().min(1).max(20).optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
});

/** Admin action on a withdrawal request. */
export const adminWithdrawActionSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["approve", "reject", "complete"]),
    txid: z.string().trim().max(120).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.action !== "complete" || (d.txid && d.txid.length >= 10), {
    message: "A transaction id (TXID) is required to complete a withdrawal.",
    path: ["txid"],
  });

export const registerSchema = z.object({
  email: z.string().email().max(120).transform((s) => s.toLowerCase().trim()),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscore only"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  // Optional referral code = the referrer's userId (25-char cuid).
  ref: z.string().trim().max(40).optional(),
  // Terms & Conditions acceptance is mandatory (enforced server-side too, not
  // just by the disabled submit button).
  acceptTerms: z
    .boolean({ required_error: "You must accept the Terms & Conditions." })
    .refine((v) => v === true, "You must accept the Terms & Conditions."),
});

export const loginSchema = z.object({
  email: z.string().email().max(120).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(100),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(100),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different from the current one.",
    path: ["newPassword"],
  });

// Minimum stakes (coin-cents). Colour/number prediction requires 100 coins;
// Crash keeps the original 50-coin minimum.
export const MIN_PREDICTION_BET_CENTS = 100 * 100;
export const MIN_CRASH_BET_CENTS = 50 * 100;

/** Integrated prediction game: selection is a colour OR a digit "0".."9". */
export const predictionBetSchema = z.object({
  selection: z
    .string()
    .refine(
      (s) =>
        ["RED", "GREEN", "VIOLET"].includes(s) ||
        (/^[0-9]$/.test(s)),
      "Pick a colour or a number 0–9."
    ),
  amount: z
    .number()
    .int()
    .min(MIN_PREDICTION_BET_CENTS, "Minimum bet is 100 coins.")
    .max(1_000_000_00), // coin-cents
});

export const crashBetSchema = z.object({
  amount: z
    .number()
    .int()
    .min(MIN_CRASH_BET_CENTS, "Minimum bet is 50 coins.")
    .max(1_000_000_00),
  // auto-cashout multiplier ×100; 0 = manual cashout only
  autoCashoutX: z.number().int().min(0).max(1_000_000),
});

/** Admin: force the result of a not-yet-settled round. */
export const forceResultSchema = z
  .object({
    roundId: z.string().min(1),
    game: z.enum(["PARITY", "SAPRE", "BCONE", "EMERD"]),
    color: z.enum(["RED", "GREEN", "VIOLET"]).optional(),
    digit: z.number().int().min(0).max(9).optional(),
  })
  .refine((d) => d.color != null || d.digit != null, {
    message: "Provide a color or a digit to force.",
  });

export const announcementSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  active: z.boolean().optional(),
});

export const settingSchema = z.object({
  key: z.string().min(1).max(60),
  // Raised from 200 to accommodate longer configurable text (e.g. the VIP
  // promotional banner copy) edited from the admin panel.
  value: z.string().max(4000),
});

/** Helper that returns a flat error message for the first failed field. */
export function firstError(err: z.ZodError): string {
  return err.errors[0]?.message ?? "Invalid input";
}

/**
 * True for a plausible user id / referral code. IDs are `cuid()` (25 chars,
 * "c"-prefixed, [a-z0-9]); some legacy rows use a 24-char hex id. Accept both.
 * A non-match is only ever a 404/ignored path (the value still goes through a
 * parameterised Prisma query), so this is a lightweight guard, not a security
 * boundary.
 */
export function isPlausibleUserId(s: string): boolean {
  return /^(c[a-z0-9]{24}|[a-f0-9]{24})$/i.test(s);
}
