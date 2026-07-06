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
  banner: { enabled: boolean; title: string; text: string };
}

const DISMISS_KEY = "vip_banner_dismissed_v1";

// Professional, modern-casino VIP promo banner (Part 6). Shows on the home and
// deposit pages for signed-in users. Responsive, animated entrance, closable
// (dismissal persisted in localStorage). All copy is admin-configurable.
export function VipBanner({ variant = "home" }: { variant?: "home" | "deposit" }) {
  const { me } = useUser();
  const [data, setData] = useState<VipData | null>(null);
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!me || dismissed) return;
    api<VipData>("/api/me/vip").then((r) => {
      if (r.ok && r.data?.banner?.enabled && r.data.enabled) {
        setData(r.data);
        // Next tick → trigger the entrance transition.
        requestAnimationFrame(() => setShown(true));
      }
    });
  }, [me, dismissed]);

  if (!me || dismissed || !data) return null;

  function close() {
    setShown(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
    setTimeout(() => setDismissed(true), 250);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-game-gold/30 bg-gradient-to-br from-[#1a1400] via-[#2a2200] to-[#0d0a00] p-4 shadow-lg transition-all duration-300 md:p-5 ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {/* Decorative animated glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 animate-pulse rounded-full bg-game-gold/20 blur-3xl" />

      <button
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-slate-300 transition hover:bg-black/50"
      >
        ✕
      </button>

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-game-gold/20 font-bold text-game-gold">★ VIP</span>
          {data.level > 0 && <VipBadge level={data.level} />}
          <h3 className="text-lg font-black text-game-gold md:text-xl">{data.banner.title}</h3>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-slate-300">{data.banner.text}</p>

        {/* Tier strip */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {data.tiers.map((t) => (
            <div
              key={t.level}
              className={`min-w-[140px] flex-1 rounded-xl border p-2.5 ${
                t.achieved
                  ? "border-game-gold/50 bg-game-gold/10"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-game-gold">VIP{t.level}</span>
                {t.achieved && <span className="text-[10px] font-bold text-game-green">ACTIVE</span>}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{t.requirement}</div>
              <div className="mt-1 text-[11px] leading-tight text-slate-200">{t.benefits[t.benefits.length - 1]}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/vip" className="btn-gold !py-2 text-sm">
            View VIP benefits
          </Link>
          {variant === "home" && (
            <Link href="/deposit" className="btn-ghost !py-2 text-sm">
              Deposit to level up
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
