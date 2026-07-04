"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "@/components/CoinIcon";
import {
  HistoryIcon,
  TrophyIcon,
  AdminIcon,
  LogoutIcon,
  ReferralIcon,
  RechargeIcon,
  WithdrawIcon,
} from "@/components/icons";
import { ChangePassword } from "@/components/ChangePassword";
import { coins } from "@/lib/fmt";

interface Txn {
  id: string;
  type: string;
  amountFmt: string;
  amount: number;
  createdAt: string;
}

const LABEL: Record<string, string> = {
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

const TXN_PREVIEW = 6;

export default function MinePage() {
  const { me, loading, logout } = useUser();
  const router = useRouter();
  const [txns, setTxns] = useState<Txn[]>([]);

  useEffect(() => {
    if (!loading && !me) router.replace("/login?next=/mine");
  }, [loading, me, router]);

  const loadTxns = useCallback(async () => {
    const r = await api<{ transactions: Txn[] }>("/api/wallet");
    if (r.ok && r.data) setTxns(r.data.transactions);
  }, []);

  // Poll transactions so payouts/credits appear without a manual refresh.
  useEffect(() => {
    if (!me) return;
    loadTxns();
    const t = setInterval(loadTxns, 8000);
    return () => clearInterval(t);
  }, [me, loadTxns]);

  if (!me) {
    return (
      <div className="space-y-3 py-2">
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Identity */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-royal-blue text-2xl font-bold text-white">
            {me.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold">{me.username}</h1>
              {me.isAdmin && (
                <span className="chip bg-game-gold/20 text-game-gold">Admin</span>
              )}
            </div>
            <div className="truncate text-sm text-slate-400">{me.email}</div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-500">
              ID: {me.id.slice(-8).toUpperCase()}
            </div>
          </div>
        </div>
        <div className="well mt-4 flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-400">Balance</span>
          <span className="flex items-center gap-1.5 text-lg font-bold text-[#111111]">
            <CoinIcon /> {coins(me.balanceFmt)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href="/deposit" className="btn-orange">
            <RechargeIcon className="h-4 w-4" /> Deposit
          </Link>
          <Link href="/withdraw" className="btn-ghost">
            <WithdrawIcon className="h-4 w-4" /> Withdraw
          </Link>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          USDT on TRON (TRC20). Send to your assigned wallet, tap “I Have Paid”,
          and coins are credited once your deposit is verified.
        </p>
      </div>

      {/* Referral shortcut */}
      <Link
        href="/referral"
        className="card glass-hover flex items-center gap-3 p-4"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-royal-blue/20 text-royal-blue-bright">
          <ReferralIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold">Promotion — invite &amp; earn</div>
          <div className="text-xs text-slate-400">
            Referral code, link, rewards and claims
          </div>
        </div>
        <span className="text-slate-500">›</span>
      </Link>

      {/* Transactions — preview only; full list lives on /transactions */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transactions</h2>
          {txns.length > 0 && (
            <Link
              href="/transactions"
              className="text-xs font-semibold text-royal-blue-bright"
            >
              View all →
            </Link>
          )}
        </div>
        {txns.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {txns.slice(0, TXN_PREVIEW).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {LABEL[t.type] || t.type}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${
                    t.amount >= 0 ? "text-game-green" : "text-slate-300"
                  }`}
                >
                  {t.amount >= 0 ? "+" : ""}
                  <CoinIcon /> {coins(t.amountFmt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="card divide-y divide-black/5 p-2">
        <Row href="/history" icon={HistoryIcon} label="Game history" />
        <Row href="/mywin" icon={TrophyIcon} label="My bets" />
        <Row href="/referral" icon={ReferralIcon} label="Promotion" />
        {me.isAdmin && <Row href="/admin" icon={AdminIcon} label="Admin panel" />}
      </div>

      {/* Change password */}
      <ChangePassword />

      <div className="px-1 text-center text-[11px] text-white/70">
        Member since {new Date(me.createdAt).toLocaleDateString()}
      </div>

      <button
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="btn-red w-full"
      >
        <LogoutIcon className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}

function Row({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: (p: { className?: string }) => React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-3 transition active:bg-black/5"
    >
      <span className="well grid h-9 w-9 place-items-center text-slate-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 text-sm font-medium text-slate-200">{label}</span>
      <span className="text-slate-500">›</span>
    </Link>
  );
}
