"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "@/components/CoinIcon";
import { Landing } from "@/components/Landing";
import { VipModal } from "@/components/VipModal";
import {
  TelegramChannelCard,
  useSiteContent,
} from "@/components/TelegramSections";
import { coins } from "@/lib/fmt";
import {
  MegaphoneIcon,
  RocketIcon,
  RechargeIcon,
  WithdrawIcon,
  MODE_ICON,
} from "@/components/icons";

interface Announcement {
  id: string;
  title: string;
  body: string;
}

const MODES = [
  { key: "PARITY", label: "Parity", color: "#4C6C06" },
  { key: "SAPRE", label: "Sapre", color: "#798DFE" },
  { key: "BCONE", label: "Bcone", color: "#8B5CF6" },
  { key: "EMERD", label: "Emerd", color: "#D81E2C" },
] as const;

export default function HomePage() {
  const { me, loading } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const content = useSiteContent();

  useEffect(() => {
    api<Announcement[]>("/api/announcements").then(
      (r) => r.ok && setAnnouncements(r.data || [])
    );
  }, []);

  const ann = announcements[0];

  // Guests get the marketing landing page; players get the dashboard.
  if (!loading && !me) return <Landing />;

  return (
    <div className="content-col space-y-4 px-3 pb-28 pt-3 sm:px-4">
      {/* VIP promo — premium modal shown once per configured interval
          (replaces the old permanently-visible banner) */}
      <VipModal />

      {/* Announcement */}
      <div className="card flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-royal-blue text-white">
          <MegaphoneIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#111111]">
            {ann ? ann.title : "Welcome to Mega 99"}
          </div>
          <p className="mt-0.5 text-sm font-medium text-[#444444]">
            {ann ? ann.body : "Predict the colour or number every 3 minutes and win big."}
          </p>
        </div>
      </div>

      {/* Wallet — white card with a gradient top strip */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between rounded-t-[18px] px-4 py-3 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #6C63FF 0%, #7A6BFF 100%)" }}
        >
          <span>My Wallet</span>
          <Link href="/transactions" className="text-xs font-semibold text-white/90">
            History →
          </Link>
        </div>
        <div className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#666666]">
            Wallet balance
          </div>
          <div className="mt-1 flex items-center gap-2 font-num text-3xl font-bold tabular-nums text-[#1D1D1F]">
            <CoinIcon size={26} />
            {me ? coins(me.balanceFmt) : "0"}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/deposit" className="btn-deposit">
              <RechargeIcon className="h-4 w-4" /> Deposit
            </Link>
            <Link href="/withdraw" className="btn-withdraw">
              <WithdrawIcon className="h-4 w-4" /> Withdraw
            </Link>
          </div>
        </div>
      </div>

      {/* Free signal channel (optional on Home, CMS-managed) */}
      {content?.channel.showHome && <TelegramChannelCard content={content.channel} />}

      {/* Game cards */}
      <section>
        <h2 className="mb-2.5 px-1 text-base font-black text-[#1D1D1F]">Games</h2>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map((m) => {
            const Icon = MODE_ICON[m.key];
            return (
              <Link
                key={m.key}
                href={`/game?mode=${m.key}`}
                className="card glass-hover flex items-center gap-3 p-4 active:scale-[0.99]"
              >
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl text-white"
                  style={{ background: m.color }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-base font-bold text-[#111111]">{m.label}</div>
                  <div className="text-xs font-medium text-[#666666]">WinGo · 3 min</div>
                </div>
              </Link>
            );
          })}
        </div>
        <Link
          href="/games/crash"
          className="card glass-hover mt-3 flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#D81E2C] text-white">
            <RocketIcon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <div className="text-base font-bold text-[#111111]">Crash</div>
            <div className="text-xs font-medium text-[#666666]">Cash out before it busts</div>
          </div>
          <span className="text-royal-blue-bright">→</span>
        </Link>
      </section>
    </div>
  );
}
