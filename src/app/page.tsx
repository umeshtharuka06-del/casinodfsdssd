"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "@/components/CoinIcon";
import { Landing } from "@/components/Landing";
import { coins } from "@/lib/fmt";
import {
  MegaphoneIcon,
  RocketIcon,
  RechargeIcon,
  WithdrawIcon,
  ReferralIcon,
  MODE_ICON,
} from "@/components/icons";

interface Announcement {
  id: string;
  title: string;
  body: string;
}

interface Txn {
  id: string;
  type: string;
  amountFmt: string;
  amount: number;
  createdAt: string;
}

const TXN_LABEL: Record<string, string> = {
  SIGNUP_BONUS: "Welcome bonus",
  BET: "Bet placed",
  PAYOUT: "Payout",
  ADMIN_CREDIT: "Admin credit",
  ADMIN_DEBIT: "Admin debit",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  WITHDRAWAL_REFUND: "Withdrawal refund",
  REFERRAL_REWARD: "Referral reward",
};

const MODES = [
  { key: "PARITY", label: "Parity", color: "#4C6C06" },
  { key: "SAPRE", label: "Sapre", color: "#798DFE" },
  { key: "BCONE", label: "Bcone", color: "#8B5CF6" },
  { key: "EMERD", label: "Emerd", color: "#D81E2C" },
] as const;

export default function HomePage() {
  const { me, loading } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);

  useEffect(() => {
    api<Announcement[]>("/api/announcements").then(
      (r) => r.ok && setAnnouncements(r.data || [])
    );
  }, []);

  const loadTxns = useCallback(async () => {
    const r = await api<{ transactions: Txn[] }>("/api/wallet");
    if (r.ok && r.data) setTxns(r.data.transactions);
  }, []);

  useEffect(() => {
    if (!me) return;
    loadTxns();
    const t = setInterval(loadTxns, 15000);
    return () => clearInterval(t);
  }, [me, loadTxns]);

  const ann = announcements[0];

  // Guests get the marketing landing page; players get the dashboard.
  if (!loading && !me) return <Landing />;

  return (
    <div className="content-col space-y-4 px-3 pb-28 pt-3 sm:px-4">
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

      {/* Wallet */}
      <div className="card overflow-hidden">
        <div className="panel-head rounded-t-2xl">
          <span>My Wallet</span>
          <Link href="/transactions" className="text-xs font-semibold text-white/90">
            History →
          </Link>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#777777]">
            Wallet balance
          </div>
          <div className="mt-1 flex items-center gap-2 font-display text-3xl font-bold tabular-nums text-[#111111]">
            <CoinIcon size={26} />
            {me ? coins(me.balanceFmt) : "0"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/deposit" className="btn-green">
              <RechargeIcon className="h-4 w-4" /> Deposit
            </Link>
            <Link href="/withdraw" className="btn-blue">
              <WithdrawIcon className="h-4 w-4" /> Withdraw
            </Link>
          </div>
        </div>
      </div>

      {/* Referral promotion */}
      <Link
        href="/referral"
        className="flex items-center gap-3 rounded-2xl bg-[#8B5CF6] p-4 shadow-[0_1px_2px_rgba(17,17,17,0.1)] transition hover:brightness-95 active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/25 text-white">
          <ReferralIcon className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Invite friends, earn rewards</div>
          <div className="text-xs font-medium text-white/90">
            Get 4 USDT in coins for every friend&apos;s first deposit.
          </div>
        </div>
        <span className="text-white">→</span>
      </Link>

      {/* Game cards */}
      <section>
        <h2 className="mb-2.5 px-1 text-base font-bold text-white">Games</h2>
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

      {/* Recent activity */}
      {txns.length > 0 && (
        <section className="card overflow-hidden">
          <div className="panel-head rounded-t-2xl">
            <span>Recent activity</span>
            <Link href="/transactions" className="text-xs font-semibold text-white/90">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-black/5 px-4">
            {txns.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-semibold text-[#111111]">
                    {TXN_LABEL[t.type] || t.type}
                  </div>
                  <div className="text-[11px] font-medium text-[#777777]">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
                    t.amount >= 0 ? "text-game-green" : "text-[#444444]"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  <CoinIcon /> {coins(t.amountFmt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
