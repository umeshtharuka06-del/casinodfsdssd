"use client";

import { useEffect, useState } from "react";
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
import { ReferralRevenueTab } from "@/components/admin/ReferralRevenueTab";
import { CryptoWithdrawalsTab } from "@/components/admin/CryptoWithdrawalsTab";
import { DepositWalletsTab } from "@/components/admin/DepositWalletsTab";
import { AdminSidebar, type NavGroup } from "@/components/admin/AdminSidebar";
import {
  HomeIcon,
  ChartIcon,
  ProfileIcon,
  ReferralIcon,
  BoltIcon,
  RechargeIcon,
  ShieldIcon,
  WithdrawIcon,
  WalletIcon,
  GameIcon,
  HistoryIcon,
  MegaphoneIcon,
  SettingsIcon,
} from "@/components/icons";

// Grouped navigation — every existing section is preserved; only the navigation
// chrome is redesigned (top tabs → sidebar/drawer).
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { key: "overview", label: "Overview", icon: HomeIcon },
      { key: "financial", label: "Financial", icon: ChartIcon },
    ],
  },
  {
    label: "Cashier",
    items: [
      { key: "deposits", label: "Deposits", icon: RechargeIcon },
      { key: "manual", label: "Manual Reviews", icon: ShieldIcon },
      { key: "withdrawals", label: "Withdrawals", icon: WithdrawIcon },
      { key: "wallets", label: "Deposit Wallets", icon: WalletIcon },
    ],
  },
  {
    label: "Players",
    items: [
      { key: "users", label: "Users", icon: ProfileIcon },
      { key: "referral-revenue", label: "Referral Revenue", icon: ReferralIcon },
    ],
  },
  {
    label: "Games",
    items: [
      { key: "force", label: "Force Result", icon: BoltIcon },
      { key: "history", label: "Game History", icon: GameIcon },
    ],
  },
  {
    label: "System",
    items: [
      { key: "logs", label: "System Logs", icon: HistoryIcon },
      { key: "announcements", label: "Announcements", icon: MegaphoneIcon },
      { key: "config", label: "Config", icon: SettingsIcon },
    ],
  },
];

const ALL_KEYS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const LABEL_OF = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);

export default function AdminPage() {
  const [tab, setTab] = useState<string>("overview");
  const [focusDeposit, setFocusDeposit] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Deep links from Telegram review alerts: /admin?tab=manual&deposit=<id>.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab");
    if (t && ALL_KEYS.includes(t)) setTab(t);
    setFocusDeposit(sp.get("deposit"));
  }, []);

  function select(key: string) {
    setTab(key);
    setMenuOpen(false);
  }

  return (
    <div className="md:flex md:gap-6">
      <AdminSidebar
        groups={NAV_GROUPS}
        active={tab}
        onSelect={select}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="min-w-0 flex-1">
        {/* Mobile header with hamburger — sticky so the menu is always reachable */}
        <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 text-[#111111] active:scale-95"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-black text-[#111111]">{LABEL_OF[tab] ?? "Admin"}</h1>
        </div>

        {/* Desktop section header */}
        <div className="mb-5 hidden items-end justify-between md:flex">
          <h1 className="text-2xl font-black text-[#111111]">{LABEL_OF[tab] ?? "Admin"}</h1>
        </div>

        <div className="pb-4">
          {tab === "overview" && <OverviewTab />}
          {tab === "financial" && <FinancialTab />}
          {tab === "users" && <UsersTab />}
          {tab === "referral-revenue" && <ReferralRevenueTab />}
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
      </div>
    </div>
  );
}
