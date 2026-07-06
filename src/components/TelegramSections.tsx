"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

// ─────────────────────────────────────────────────────────────────────────────
// CMS-managed Telegram sections (Admin → Config):
//   • Free signal channel  — "Free VIP Signals" join card
//   • Telegram support     — support contact card with online status
// Both render nothing until enabled AND given a URL, so an unconfigured
// platform never shows a broken section.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChannelContent {
  enabled: boolean;
  title: string;
  description: string;
  button: string;
  url: string;
  order: number;
  showHome: boolean;
}
export interface SupportContent {
  enabled: boolean;
  title: string;
  description: string;
  username: string;
  url: string;
  status: string;
  button: string;
  order: number;
}
export interface SiteContent {
  channel: ChannelContent;
  support: SupportContent;
}

/** Fetch the public CMS content once per mount. */
export function useSiteContent(): SiteContent | null {
  const [content, setContent] = useState<SiteContent | null>(null);
  useEffect(() => {
    let alive = true;
    api<SiteContent>("/api/content").then((r) => {
      if (alive && r.ok && r.data) setContent(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return content;
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.94 4.14a1.5 1.5 0 0 0-2.03-1.02L2.9 9.7c-1.23.48-1.2 2.24.05 2.67l4.4 1.51 1.7 5.36c.37 1.16 1.85 1.45 2.62.52l2.34-2.83 4.55 3.33c.86.63 2.08.16 2.3-.89l3.03-14.16a1.5 1.5 0 0 0-.95-1.07ZM9.2 13.05l8.02-5.06c.36-.23.74.26.43.55l-6.44 5.87a1.5 1.5 0 0 0-.47.9l-.25 2.03c-.03.28-.42.32-.51.05l-.98-3.1a1 1 0 0 1 .2-1.24Z" />
    </svg>
  );
}

/** "Free VIP Signals" — join-the-channel card (Mine page + optionally Home). */
export function TelegramChannelCard({ content }: { content: ChannelContent }) {
  if (!content.enabled) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-royal-blue text-white">
          <TelegramIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[#111111]">{content.title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
            {content.description}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          className="btn-blue w-full !py-2.5 text-sm"
        >
          <TelegramIcon className="h-4 w-4" /> {content.button}
        </a>
      </div>
    </div>
  );
}

/** Telegram support contact card with online status (Mine page). */
export function TelegramSupportCard({ content }: { content: SupportContent }) {
  if (!content.enabled) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-game-green text-white">
          <TelegramIcon className="h-6 w-6" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-game-green" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#111111]">{content.title}</span>
            {content.status && (
              <span className="chip flex items-center gap-1 bg-game-green/15 text-game-green">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-game-green" />
                {content.status}
              </span>
            )}
          </div>
          {content.username && (
            <div className="mt-0.5 font-mono text-xs text-royal-blue-bright">
              @{content.username.replace(/^@/, "")}
            </div>
          )}
          <div className="mt-0.5 text-xs leading-relaxed text-slate-400">
            {content.description}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          className="btn-green w-full !py-2.5 text-sm"
        >
          <TelegramIcon className="h-4 w-4" /> {content.button}
        </a>
      </div>
    </div>
  );
}
