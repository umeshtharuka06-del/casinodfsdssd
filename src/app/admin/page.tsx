"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { FinancialTab } from "@/components/admin/FinancialTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { GameHistoryTab } from "@/components/admin/GameHistoryTab";
import { LogsTab } from "@/components/admin/LogsTab";
import { ForceResultTab } from "@/components/admin/ForceResultTab";
import { AnnouncementsTab } from "@/components/admin/AnnouncementsTab";
import { ConfigTab } from "@/components/admin/ConfigTab";
import { DepositsTab } from "@/components/admin/DepositsTab";
import { ManualReviewsTab } from "@/components/admin/ManualReviewsTab";
import { CryptoWithdrawalsTab } from "@/components/admin/CryptoWithdrawalsTab";
import { DepositWalletsTab } from "@/components/admin/DepositWalletsTab";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "financial", label: "Financial" },
  { key: "users", label: "Users" },
  { key: "force", label: "Force Result" },
  { key: "deposits", label: "Deposits" },
  { key: "manual", label: "Manual Reviews" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "wallets", label: "Deposit Wallets" },
  { key: "history", label: "Game History" },
  { key: "logs", label: "System Logs" },
  { key: "announcements", label: "Announcements" },
  { key: "config", label: "Config" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [focusDeposit, setFocusDeposit] = useState<string | null>(null);

  // Deep links from Telegram review alerts: /admin?tab=manual&deposit=<id>.
  // Read on mount from window.location (client-only console; avoids the
  // useSearchParams Suspense requirement).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
    setFocusDeposit(sp.get("deposit"));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#111111] md:text-3xl">Admin Console</h1>
          <p className="text-sm text-slate-400">Manage games, users and the platform.</p>
        </div>
        <Link href="/" className="btn-ghost !py-2 text-sm">
          ← Back to app
        </Link>
      </div>

      {/* Tab bar — scrolls horizontally on small screens, no overflow elsewhere */}
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-black/10 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-royal-blue text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "financial" && <FinancialTab />}
      {tab === "users" && <UsersTab />}
      {tab === "force" && <ForceResultTab />}
      {tab === "deposits" && <DepositsTab />}
      {tab === "manual" && <ManualReviewsTab focusId={focusDeposit} />}
      {tab === "withdrawals" && <CryptoWithdrawalsTab />}
      {tab === "wallets" && <DepositWalletsTab />}
      {tab === "history" && <GameHistoryTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}
