"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "parity_round_seconds", label: "Parity round (s)", hint: "Round length for Parity" },
  { key: "sapre_round_seconds", label: "Sapre round (s)", hint: "Round length for Sapre" },
  { key: "bcone_round_seconds", label: "Bcone round (s)", hint: "Round length for Bcone" },
  { key: "emerd_round_seconds", label: "Emerd round (s)", hint: "Round length for Emerd" },
  { key: "prediction_lock_seconds", label: "Prediction lock window (s)", hint: "Betting closes N s before draw" },
  { key: "prediction_heavy_win_rate", label: "Heavy win rate (0–1)", hint: "How often the most-backed side wins" },
  { key: "crash_betting_seconds", label: "Crash betting window (s)", hint: "Time to place a crash bet" },
  { key: "crash_house_edge_pct", label: "Crash house edge (%)", hint: "Instant-bust probability" },
  { key: "crash_auto_cashout_enabled", label: "Crash auto-cashout", hint: "true / false — show the auto-cashout field" },
  { key: "house_fee_enabled", label: "House fee enabled", hint: "true / false" },
  { key: "house_fee_type", label: "House fee type", hint: "percentage / flat" },
  { key: "house_fee_value", label: "House fee value", hint: "2 = 2% (percentage) or 2 coins (flat)" },

  // ── Referral qualification (Part 4) ──
  { key: "referral_qualification_enabled", label: "Referral qualification", hint: "true / false — only approved-deposit referrals count" },

  // ── VIP tiers (Part 5) ──
  { key: "vip_enabled", label: "VIP system enabled", hint: "true / false" },
  { key: "vip1_min_deposit_usdt", label: "VIP1 min deposit (USDT)", hint: "Deposit threshold for VIP1" },
  { key: "vip1_min_referrals", label: "VIP1 min referrals", hint: "Qualified-referral threshold (0 = disabled)" },
  { key: "vip1_signal_group", label: "VIP1 signal group", hint: "Reward channel name" },
  { key: "vip2_min_deposit_usdt", label: "VIP2 min deposit (USDT)", hint: "Deposit threshold for VIP2" },
  { key: "vip2_min_referrals", label: "VIP2 min referrals", hint: "Qualified-referral threshold (0 = disabled)" },
  { key: "vip2_signal_group", label: "VIP2 signal group", hint: "Reward channel name" },
  { key: "vip3_min_deposit_usdt", label: "VIP3 min deposit (USDT)", hint: "Deposit threshold for VIP3" },
  { key: "vip3_min_referrals", label: "VIP3 min referrals", hint: "Qualified-referral threshold (0 = disabled)" },
  { key: "vip3_signal_group", label: "VIP3 signal group", hint: "Reward channel name" },
  { key: "vip4_min_deposit_usdt", label: "VIP4 min deposit (USDT)", hint: "Deposit-only tier" },
  { key: "vip4_signal_group", label: "VIP4 signal group", hint: "Reward channel name" },
  { key: "vip4_daily_signals", label: "VIP4 daily signals", hint: "Guaranteed signals per day" },
  { key: "vip4_priority_support", label: "VIP4 priority support", hint: "true / false" },
  { key: "vip5_min_deposit_usdt", label: "VIP5 min deposit (USDT)", hint: "Deposit-only tier" },
  { key: "vip5_signal_group", label: "VIP5 signal group", hint: "Reward channel name" },
  { key: "vip5_daily_login_bonus_usdt", label: "VIP5 daily login bonus (USDT)", hint: "Daily login bonus" },

  // ── VIP banner (deposit page) ──
  { key: "vip_banner_enabled", label: "VIP banner enabled", hint: "true / false" },
  { key: "vip_banner_title", label: "VIP banner title", hint: "Headline shown on the banner" },
  { key: "vip_banner_text", label: "VIP banner text", hint: "Promotional copy shown on the banner" },

  // ── VIP popup (home page modal) ──
  { key: "vip_popup_enabled", label: "VIP popup enabled", hint: "true / false" },
  { key: "vip_popup_title", label: "VIP popup title", hint: "Headline of the home-page modal" },
  { key: "vip_popup_description", label: "VIP popup description", hint: "Subtitle copy of the modal" },
  { key: "vip_popup_image", label: "VIP popup image URL", hint: "Optional image at the top of the modal" },
  { key: "vip_popup_primary_text", label: "VIP popup primary button", hint: "Primary CTA label" },
  { key: "vip_popup_primary_url", label: "VIP popup primary URL", hint: "Primary CTA destination (e.g. /deposit)" },
  { key: "vip_popup_secondary_text", label: "VIP popup secondary button", hint: "Secondary CTA label" },
  { key: "vip_popup_secondary_url", label: "VIP popup secondary URL", hint: "Secondary CTA destination (e.g. /vip)" },
  { key: "vip_popup_delay_seconds", label: "VIP popup delay (s)", hint: "Seconds after page load before showing" },
  { key: "vip_popup_interval_hours", label: "VIP popup interval (h)", hint: "Hours before the popup re-appears" },

  // ── Free signal channel (CMS) ──
  { key: "tg_channel_enabled", label: "Signal channel enabled", hint: "true / false (needs a URL to show)" },
  { key: "tg_channel_title", label: "Signal channel title", hint: "Section headline" },
  { key: "tg_channel_description", label: "Signal channel description", hint: "Section copy" },
  { key: "tg_channel_button", label: "Signal channel button", hint: "CTA label" },
  { key: "tg_channel_url", label: "Signal channel URL", hint: "https://t.me/… (empty hides the section)" },
  { key: "tg_channel_order", label: "Signal channel order", hint: "Display order on the Mine page" },
  { key: "tg_channel_show_home", label: "Signal channel on Home", hint: "true / false — also show on Home" },

  // ── Telegram support (CMS) ──
  { key: "tg_support_enabled", label: "Support section enabled", hint: "true / false (needs a URL to show)" },
  { key: "tg_support_title", label: "Support title", hint: "Section headline" },
  { key: "tg_support_description", label: "Support description", hint: "Section copy" },
  { key: "tg_support_username", label: "Support username", hint: "Telegram @username (shown to users)" },
  { key: "tg_support_url", label: "Support URL", hint: "https://t.me/… (empty hides the section)" },
  { key: "tg_support_status", label: "Support status", hint: "Status label, e.g. Online" },
  { key: "tg_support_button", label: "Support button", hint: "CTA label" },
  { key: "tg_support_order", label: "Support order", hint: "Display order on the Mine page" },

  // ── Withdrawal limits (Part 8) ──
  { key: "withdraw_limits_enabled", label: "Withdrawal limits enabled", hint: "true / false" },
  { key: "withdraw_daily_max_usdt", label: "Daily withdrawal max (USDT)", hint: "Max total sent per rolling 24h" },
  { key: "withdraw_min_usdt", label: "Minimum withdrawal (USDT)", hint: "Smallest allowed request" },
  { key: "withdraw_receive_floor_usdt", label: "Min received after fee (USDT)", hint: "User must net at least this" },

  // ── Withdrawal eligibility (Part 9) ──
  { key: "withdraw_eligibility_enabled", label: "Withdrawal eligibility enabled", hint: "true / false" },
  { key: "withdraw_min_qualified_referrals", label: "Min qualified referrals", hint: "Required to withdraw" },
  { key: "withdraw_profit_t1_max_usdt", label: "Profit tier 1 max deposit (USDT)", hint: "Upper bound of band 1" },
  { key: "withdraw_profit_t1_usdt", label: "Profit tier 1 required (USDT)", hint: "Net profit needed in band 1" },
  { key: "withdraw_profit_t2_max_usdt", label: "Profit tier 2 max deposit (USDT)", hint: "Upper bound of band 2" },
  { key: "withdraw_profit_t2_usdt", label: "Profit tier 2 required (USDT)", hint: "Net profit needed in band 2" },
  { key: "withdraw_profit_t3_max_usdt", label: "Profit tier 3 max deposit (USDT)", hint: "Upper bound of band 3" },
  { key: "withdraw_profit_t3_usdt", label: "Profit tier 3 required (USDT)", hint: "Net profit needed in band 3" },
  { key: "withdraw_profit_above_usdt", label: "Profit above top tier (USDT)", hint: "Net profit needed above band 3" },
];

export function ConfigTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");

  async function load() {
    const res = await api<Record<string, string>>("/api/admin/config");
    if (res.ok) setSettings(res.data || {});
  }
  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    await api("/api/admin/config", { json: { key, value: settings[key] ?? "" } });
    setSaved(key);
    setTimeout(() => setSaved(""), 1500);
  }

  return (
    <div className="card p-4 md:p-5">
      <h3 className="mb-4 text-sm font-bold text-[#111111]">Platform configuration</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              {f.label}
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                value={settings[f.key] ?? ""}
                onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
              />
              <button onClick={() => save(f.key)} className="btn-ghost">
                {saved === f.key ? "✓" : "Save"}
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">{f.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
