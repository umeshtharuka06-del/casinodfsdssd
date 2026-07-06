"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { VipBadge } from "@/components/VipBadge";

interface Tier {
  level: number;
  requirement: string;
  benefits: string[];
  achieved: boolean;
}
interface VipData {
  enabled: boolean;
  level: number;
  tiers: Tier[];
}
interface PopupCfg {
  enabled: boolean;
  title: string;
  description: string;
  image: string;
  primaryText: string;
  primaryUrl: string;
  secondaryText: string;
  secondaryUrl: string;
  delaySeconds: number;
  intervalHours: number;
}

// localStorage key holding the last-shown timestamp (ms). The popup re-appears
// once the configured interval (default 24h) has elapsed.
const SHOWN_AT_KEY = "vip_popup_shown_at";

/**
 * Premium VIP promo modal for the Home page (replaces the permanent banner).
 * Shows once per configured interval for signed-in users, is closable, and all
 * copy/timing is managed from Admin → Config.
 */
export function VipModal() {
  const { me } = useUser();
  const [cfg, setCfg] = useState<PopupCfg | null>(null);
  const [vip, setVip] = useState<VipData | null>(null);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  // Load config + VIP tiers, then decide whether the interval has elapsed.
  useEffect(() => {
    if (!me) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const [contentRes, vipRes] = await Promise.all([
        api<{ vipPopup: PopupCfg }>("/api/content"),
        api<VipData>("/api/me/vip"),
      ]);
      if (!alive) return;
      const popup = contentRes.ok ? contentRes.data?.vipPopup : undefined;
      const vipData = vipRes.ok ? vipRes.data : undefined;
      if (!popup?.enabled || !vipData?.enabled) return;

      const last = Number(window.localStorage.getItem(SHOWN_AT_KEY) || "0");
      const intervalMs = popup.intervalHours * 60 * 60 * 1000;
      if (Number.isFinite(last) && last > 0 && Date.now() - last < intervalMs) return;

      setCfg(popup);
      setVip(vipData);
      timer = setTimeout(() => {
        if (!alive) return;
        setOpen(true);
        window.localStorage.setItem(SHOWN_AT_KEY, String(Date.now()));
        requestAnimationFrame(() => setEntered(true));
      }, popup.delaySeconds * 1000);
    })();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [me]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setEntered(false);
    setTimeout(() => setOpen(false), 200);
  }

  if (!open || !cfg || !vip) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm transition-opacity duration-200 sm:items-center sm:p-4 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={cfg.title}
    >
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-t-3xl border border-game-gold/30 bg-gradient-to-br from-[#1a1400] via-[#2a2200] to-[#0d0a00] shadow-2xl transition-transform duration-200 sm:rounded-3xl ${
          entered ? "translate-y-0" : "translate-y-6"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 animate-pulse rounded-full bg-game-gold/20 blur-3xl" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-slate-300 transition hover:bg-black/60"
        >
          ✕
        </button>

        {cfg.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.image} alt="" className="h-32 w-full object-cover sm:h-40" />
        )}

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="chip bg-game-gold/20 font-bold text-game-gold">★ VIP</span>
            {vip.level > 0 && <VipBadge level={vip.level} />}
          </div>
          <h2 className="mt-2 text-xl font-black text-game-gold sm:text-2xl">{cfg.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{cfg.description}</p>

          {/* VIP levels — premium horizontal card strip */}
          <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {vip.tiers.map((t) => (
              <div
                key={t.level}
                className={`w-[150px] shrink-0 rounded-xl border p-3 ${
                  t.achieved
                    ? "border-game-gold/50 bg-game-gold/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-game-gold">VIP{t.level}</span>
                  {t.achieved && (
                    <span className="text-[10px] font-bold text-game-green">ACTIVE</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] leading-tight text-slate-400">
                  {t.requirement}
                </div>
                <div className="mt-1.5 text-[11px] font-medium leading-tight text-slate-200">
                  {t.benefits[t.benefits.length - 1]}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <Link href={cfg.primaryUrl} onClick={close} className="btn-gold w-full !py-3 text-sm">
              {cfg.primaryText}
            </Link>
            <Link href={cfg.secondaryUrl} onClick={close} className="btn-ghost w-full !py-3 text-sm">
              {cfg.secondaryText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
