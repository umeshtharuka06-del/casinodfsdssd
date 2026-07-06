import { prisma } from "./db";

/** Default platform settings, overridable from the admin panel. */
export const DEFAULT_SETTINGS: Record<string, string> = {
  // Integrated prediction game — one round stream per mode. Each carries both
  // colour and number bets. Betting closes `prediction_lock_seconds` before end.
  // All four modes run on a 3-minute (180s) round schedule.
  parity_round_seconds: "180",
  sapre_round_seconds: "180",
  bcone_round_seconds: "180",
  emerd_round_seconds: "180",
  prediction_lock_seconds: "5",
  crash_betting_seconds: "8",
  crash_house_edge_pct: "1",
  // When "false", the manual/auto cashout multiplier UI is hidden and crash is
  // pure manual cash-out only.
  crash_auto_cashout_enabled: "true",
  // House fee taken on every bet's stake. effectiveBet = stake - fee, and
  // settlement pays out on effectiveBet. type = "percentage" | "flat".
  house_fee_enabled: "true",
  house_fee_type: "percentage",
  house_fee_value: "2", // 2% (percentage) OR 2 coins (flat)
  // ── Crypto (TRC20 USDT) deposits & withdrawals ──
  // Deposit wallets are managed as DepositWallet rows (Admin → Deposit Wallets),
  // not a single env/setting. The poller watches the wallets that have pending
  // requests and credits matched transfers when crypto_auto_credit is on.
  crypto_auto_credit: "true",
  crypto_usdt_contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // official USDT TRC20 contract
  crypto_min_deposit_usdt: "10",
  crypto_min_withdraw_coins: "1100", // = 11 USDT at 100 coins/USDT
  crypto_withdraw_fee_usdt: "1",
  crypto_coins_per_usdt: "100",
  crypto_confirmations: "20",
  crypto_poll_seconds: "30",
  // ── Referral rewards ──
  // Fixed reward (USDT face value, converted at crypto_coins_per_usdt) the
  // referrer earns when a referred user makes their FIRST approved deposit.
  referral_reward_usdt: "4",
  // Holding period before a referral reward becomes claimable.
  referral_lock_days: "7",
  // ── Telegram notifications ──
  // Telegram credentials are NEVER stored in the DB or edited from the admin
  // panel — they come exclusively from the server environment (see src/lib/
  // telegram.ts): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and the optional
  // TELEGRAM_LARGE_DEPOSIT_USDT / TELEGRAM_LARGE_WITHDRAW_USDT thresholds.
  // Prediction engine: how often the most-backed ("heavy") side still wins.
  // 0.4 = the heavy side wins ~4 rounds out of 10. The website only stores this
  // value; the engine service (engine-royal/) reads it when settling rounds.
  prediction_heavy_win_rate: "0.4",

  // ── Referral qualification ──
  // A referral only counts once the referred user completes ≥1 approved deposit.
  // Registration alone never counts. When disabled, qualification tracking is
  // skipped (existing ReferralReward flow is unaffected).
  referral_qualification_enabled: "true",

  // ── VIP tiers ──
  // A user reaches a tier by meeting its deposit threshold OR (for tiers where
  // it is > 0) its qualified-referral threshold. A referral threshold of 0
  // disables the referral path for that tier (VIP4/VIP5 are deposit-only).
  // `_signal_group` is the Telegram/signal channel name granted at that tier.
  vip_enabled: "true",
  vip1_min_deposit_usdt: "1000",
  vip1_min_referrals: "50",
  vip1_signal_group: "VIP1 Signal Group",
  vip2_min_deposit_usdt: "3000",
  vip2_min_referrals: "150",
  vip2_signal_group: "VIP2 Signal Group",
  vip3_min_deposit_usdt: "5000",
  vip3_min_referrals: "250",
  vip3_signal_group: "VIP3 Signal Group",
  vip4_min_deposit_usdt: "10000",
  vip4_min_referrals: "0", // deposit-only tier
  vip4_signal_group: "VIP4 Signal Group",
  vip4_daily_signals: "10", // guaranteed daily signals
  vip4_priority_support: "true",
  vip5_min_deposit_usdt: "50000",
  vip5_min_referrals: "0", // deposit-only tier
  vip5_signal_group: "VIP5 Signal Group",
  vip5_daily_login_bonus_usdt: "300",

  // ── VIP promotional banner (deposit page) ──
  vip_banner_enabled: "true",
  vip_banner_title: "Unlock VIP Rewards",
  vip_banner_text:
    "Climb the VIP ladder for exclusive signal groups, guaranteed daily signals, priority support and daily login bonuses. The more you play, the more you unlock.",

  // ── VIP popup (home page modal — replaces the permanent home banner) ──
  vip_popup_enabled: "true",
  vip_popup_title: "Unlock VIP Rewards",
  vip_popup_description:
    "Deposit more and unlock exclusive VIP signal groups, priority support, cashback rewards and daily bonuses.",
  vip_popup_image: "", // optional image URL shown at the top of the popup
  vip_popup_primary_text: "Deposit to Unlock VIP Signals",
  vip_popup_primary_url: "/deposit",
  vip_popup_secondary_text: "View VIP Benefits",
  vip_popup_secondary_url: "/vip",
  vip_popup_delay_seconds: "2", // wait N seconds after page load before showing
  vip_popup_interval_hours: "24", // re-show after this many hours

  // ── Free signal channel section (CMS) ──
  tg_channel_enabled: "true",
  tg_channel_title: "Free VIP Signals",
  tg_channel_description: "Join our free signal channel and receive daily winning signals.",
  tg_channel_button: "Join Telegram",
  tg_channel_url: "",
  tg_channel_order: "1", // display order among the Mine-page CMS sections
  tg_channel_show_home: "false", // also show the section on the Home page

  // ── Telegram support section (CMS) ──
  tg_support_enabled: "true",
  tg_support_title: "Telegram Support",
  tg_support_description: "Questions about deposits, withdrawals or your account? We're here 24/7.",
  tg_support_username: "",
  tg_support_url: "",
  tg_support_status: "Online",
  tg_support_button: "Contact Support",
  tg_support_order: "2",

  // ── Withdrawal limits (Part 8) — transparent, configurable ──
  // Anti-abuse limits. Users see the accurate reason when a rule blocks them.
  withdraw_limits_enabled: "true",
  withdraw_daily_max_usdt: "300", // max total sent per rolling 24h
  withdraw_min_usdt: "11", // minimum request amount
  withdraw_receive_floor_usdt: "10", // user must net at least this after fee

  // ── Withdrawal eligibility (Part 9) — transparent, configurable ──
  // Anti-abuse gate preventing instant deposit→withdraw cycling. Requires a
  // minimum number of qualified referrals AND a minimum net betting profit that
  // scales with the user's total approved deposits. Users see the exact reason.
  withdraw_eligibility_enabled: "true",
  withdraw_min_qualified_referrals: "2",
  // Net-profit tiers by total approved deposit (USDT). Each tier's max is the
  // upper bound of the deposit band; the "above" value applies past the last tier.
  withdraw_profit_t1_max_usdt: "50",
  withdraw_profit_t1_usdt: "5",
  withdraw_profit_t2_max_usdt: "100",
  withdraw_profit_t2_usdt: "10",
  withdraw_profit_t3_max_usdt: "500",
  withdraw_profit_t3_usdt: "50",
  withdraw_profit_above_usdt: "100",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function getSettingNumber(key: string): Promise<number> {
  return Number(await getSetting(key));
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
