// ────────────────────────────────────────────────────────────────────────────
// Telegram notifications.
//
// Credentials come EXCLUSIVELY from the server environment (the VPS), never from
// the database and never from the admin panel:
//
//   TELEGRAM_BOT_TOKEN   — the bot token from @BotFather
//   TELEGRAM_CHAT_ID     — the destination chat / channel / group id
//   TELEGRAM_LARGE_DEPOSIT_USDT   (optional, default 1000) — "large" alert threshold
//   TELEGRAM_LARGE_WITHDRAW_USDT  (optional, default 1000)
//
// The integration is "enabled" simply when both the bot token and chat id are
// present in the environment — there is no separate DB toggle. This is what fixed
// the long-standing "test works but real events never arrive" bug: the old code
// gated every real notification behind a `telegram_enabled` DB flag (default
// "false") and DB-stored credentials, while the manual Test button bypassed that
// flag with the values typed into the form. If the operator never toggled
// Enabled + Saved (or the running deploy pointed at a different DB), every real
// event silently returned false. Reading straight from process.env removes both
// the flag gate and the DB dependency.
//
// Delivery is INLINE (in-process) — the same reliable path the old Test button
// used — so a notification is never lost to an undrained job queue. Every
// notifier is fully guarded: a Telegram outage or a bad token must NEVER break
// the user/admin request it is attached to. Errors are LOGGED (not silently
// swallowed) so a broken integration is visible in the container logs.
// ────────────────────────────────────────────────────────────────────────────

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  largeDepositUsdt: number;
  largeWithdrawUsdt: number;
}

/** Read Telegram config from the environment (VPS) only. Never touches the DB. */
function getTelegramConfig(): TelegramConfig {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const num = (k: string, d: number) => {
    const n = Number(process.env[k]);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    enabled: !!botToken && !!chatId,
    botToken,
    chatId,
    largeDepositUsdt: num("TELEGRAM_LARGE_DEPOSIT_USDT", 1000),
    largeWithdrawUsdt: num("TELEGRAM_LARGE_WITHDRAW_USDT", 1000),
  };
}

/**
 * Send a notification. Delivers INLINE (in-process) so a notification is never
 * lost to an undrained job queue. Guarded: never throws into the caller's
 * request flow. Returns true when Telegram accepted the message.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  return deliverTelegram(text);
}

/**
 * Perform the outbound Telegram send. Honours the env config. When the
 * integration isn't configured (missing token or chat id) it LOGS the reason and
 * returns false — it never throws.
 */
export async function deliverTelegram(text: string): Promise<boolean> {
  const cfg = getTelegramConfig();
  if (!cfg.enabled) {
    const reason = !cfg.botToken
      ? "TELEGRAM_BOT_TOKEN is not set in the server environment"
      : "TELEGRAM_CHAT_ID is not set in the server environment";
    console.warn(`[telegram] notification NOT sent — ${reason}`);
    return false;
  }
  return rawSend(cfg.botToken, cfg.chatId, text);
}

async function rawSend(botToken: string, chatId: string, text: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Surface the exact Telegram API error (e.g. "chat not found", "bot was
      // blocked", bad token) instead of silently dropping it.
      const body = await res.text().catch(() => "");
      console.error(
        `[telegram] Telegram API rejected the message: HTTP ${res.status} ${body.slice(0, 300)}`
      );
    }
    return res.ok;
  } catch (e) {
    // Non-fatal for the request flow, but no longer silent — log it.
    console.error("[telegram] send failed:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── Message formatting ──────────────────────────────────────────────────────

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function now(): string {
  // "YYYY-MM-DD HH:mm" in UTC.
  return new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Build a "Title\n\nKey: value" block in the spec's layout. */
function format(title: string, fields: Record<string, string | number | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`);
  return `<b>${esc(title)}</b>\n\n${lines.join("\n")}`;
}

// ── Event notifiers (each guarded; safe to call without await-handling) ──────

export async function notifyNewUser(p: { username: string; uid: string }) {
  await sendTelegram(
    format("🆕 New User Registration", {
      User: p.username,
      UID: p.uid,
      Time: now(),
    })
  );
}

export async function notifyDepositRequest(p: {
  username: string;
  uid: string;
  amountUsdt: number;
  coins: string;
  wallet: string;
}) {
  const cfg = getTelegramConfig();
  const large = p.amountUsdt >= cfg.largeDepositUsdt;
  await sendTelegram(
    format(large ? "💰 New Deposit (LARGE)" : "💰 New Deposit Request", {
      User: p.username,
      UID: p.uid,
      Amount: `${p.amountUsdt} USDT (${p.coins} coins)`,
      Wallet: p.wallet,
      Time: now(),
      Status: "Pending",
    })
  );
}

export async function notifyDepositApproved(p: {
  username: string;
  uid: string;
  coins: string;
  wallet: string;
  via: "auto" | "admin";
}) {
  await sendTelegram(
    format("✅ Deposit Approved", {
      User: p.username,
      UID: p.uid,
      Amount: `${p.coins} coins`,
      Wallet: p.wallet,
      Via: p.via === "auto" ? "Auto-detected" : "Admin",
      Time: now(),
      Status: "Approved",
    })
  );
}

export async function notifyDepositRejected(p: {
  username: string;
  uid: string;
  amountUsdt?: number;
  coins?: string;
  note?: string;
}) {
  await sendTelegram(
    format("❌ Deposit Rejected", {
      User: p.username,
      UID: p.uid,
      Amount:
        p.amountUsdt !== undefined
          ? `${p.amountUsdt} USDT${p.coins ? ` (${p.coins} coins)` : ""}`
          : p.coins
          ? `${p.coins} coins`
          : undefined,
      Reason: p.note,
      Time: now(),
      Status: "Rejected",
    })
  );
}

export async function notifyWithdrawRequest(p: {
  username: string;
  uid: string;
  coins: string;
  usdt: number;
  address: string;
}) {
  const cfg = getTelegramConfig();
  const large = p.usdt >= cfg.largeWithdrawUsdt;
  await sendTelegram(
    format(large ? "🏧 Withdraw Request (LARGE)" : "🏧 Withdraw Request", {
      User: p.username,
      UID: p.uid,
      Amount: `${p.coins} coins (${p.usdt.toFixed(2)} USDT)`,
      Destination: p.address,
      Time: now(),
      Status: "Pending",
    })
  );
}

export async function notifyWithdrawResolved(p: {
  username: string;
  uid: string;
  coins: string;
  address: string;
  status: "Approved" | "Completed" | "Rejected";
}) {
  const icon = p.status === "Rejected" ? "❌" : "✅";
  await sendTelegram(
    format(`${icon} Withdraw ${p.status}`, {
      User: p.username,
      UID: p.uid,
      Amount: `${p.coins} coins`,
      Destination: p.address,
      Time: now(),
      Status: p.status,
    })
  );
}

export async function notifyReferralClaim(p: {
  username: string;
  uid: string;
  coins: string;
}) {
  await sendTelegram(
    format("🎁 Referral Reward Claimed", {
      User: p.username,
      UID: p.uid,
      Amount: `${p.coins} coins`,
      Time: now(),
      Status: "Claimed",
    })
  );
}

export async function notifyAdminLogin(p: { username: string; uid: string; ip?: string }) {
  await sendTelegram(
    format("🔐 Admin Login", {
      User: p.username,
      UID: p.uid,
      IP: p.ip,
      Time: now(),
    })
  );
}
