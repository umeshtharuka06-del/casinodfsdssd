// ─────────────────────────────────────────────────────────────────────────────
// Icon system — Heroicons ONLY.
//
// The whole app imports icons from this module under stable, app-specific names.
// Each name maps to a Heroicon (outline set for normal UI). Consumers are
// unchanged; changing the mapping here re-skins every icon site-wide. Heroicons
// inherit the current text colour (`currentColor`) and take a `className` for the
// 16/20/24/32px size scale (h-4/h-5/h-6/h-8). This is the single icon library in
// the project — no other icon package is used.
// ─────────────────────────────────────────────────────────────────────────────

import {
  HomeIcon,
  SpeakerWaveIcon,
  SwatchIcon,
  SparklesIcon,
  FireIcon,
  StarIcon,
  RocketLaunchIcon,
  Squares2X2Icon,
  WalletIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  GiftIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  TrophyIcon,
  ArrowLeftOnRectangleIcon,
  BoltIcon,
  EyeIcon,
  EyeSlashIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

export {
  HomeIcon,
  SpeakerWaveIcon as MegaphoneIcon,
  SwatchIcon as ColorIcon,
  SparklesIcon as ParityIcon,
  FireIcon as SapreIcon,
  BoltIcon as BconeIcon,
  StarIcon as EmerdIcon,
  RocketLaunchIcon as RocketIcon,
  Squares2X2Icon as GameIcon,
  WalletIcon,
  ArrowDownTrayIcon as RechargeIcon,
  ArrowUpTrayIcon as WithdrawIcon,
  ClockIcon as HistoryIcon,
  GiftIcon as ReferralIcon,
  UserCircleIcon as ProfileIcon,
  Cog6ToothIcon as SettingsIcon,
  ShieldCheckIcon as AdminIcon,
  ShieldCheckIcon as ShieldIcon,
  TrophyIcon,
  ArrowLeftOnRectangleIcon as LogoutIcon,
  BoltIcon,
  EyeIcon,
  EyeSlashIcon as EyeOffIcon,
  ChartBarIcon as ChartIcon,
};

// Game-mode icons (home game cards + game page tabs).
export const MODE_ICON = {
  PARITY: SparklesIcon,
  SAPRE: FireIcon,
  BCONE: BoltIcon,
  EMERD: StarIcon,
} as const;
