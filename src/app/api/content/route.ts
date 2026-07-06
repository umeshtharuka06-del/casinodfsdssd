import { getAllSettings } from "@/lib/settings";
import { ok } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public CMS content for the marketing/support sections (free signal channel,
// Telegram support, VIP popup). Display-only strings managed from Admin →
// Config — no secrets and no user data, so no auth is required.
export async function GET() {
  const s = await getAllSettings();
  const bool = (k: string, d = true) => (s[k] === undefined ? d : s[k] !== "false");
  const num = (k: string, d: number) => {
    const n = Number(s[k]);
    return Number.isFinite(n) ? n : d;
  };
  const str = (k: string) => (s[k] ?? "").trim();

  return ok({
    channel: {
      enabled: bool("tg_channel_enabled") && str("tg_channel_url").length > 0,
      title: str("tg_channel_title"),
      description: str("tg_channel_description"),
      button: str("tg_channel_button"),
      url: str("tg_channel_url"),
      order: num("tg_channel_order", 1),
      showHome: bool("tg_channel_show_home", false),
    },
    support: {
      enabled: bool("tg_support_enabled") && str("tg_support_url").length > 0,
      title: str("tg_support_title"),
      description: str("tg_support_description"),
      username: str("tg_support_username"),
      url: str("tg_support_url"),
      status: str("tg_support_status"),
      button: str("tg_support_button"),
      order: num("tg_support_order", 2),
    },
    vipPopup: {
      enabled: bool("vip_popup_enabled"),
      title: str("vip_popup_title"),
      description: str("vip_popup_description"),
      image: str("vip_popup_image"),
      primaryText: str("vip_popup_primary_text"),
      primaryUrl: str("vip_popup_primary_url") || "/deposit",
      secondaryText: str("vip_popup_secondary_text"),
      secondaryUrl: str("vip_popup_secondary_url") || "/vip",
      delaySeconds: Math.max(0, num("vip_popup_delay_seconds", 2)),
      intervalHours: Math.max(1, num("vip_popup_interval_hours", 24)),
    },
  });
}
