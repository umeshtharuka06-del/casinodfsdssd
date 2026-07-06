"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { CoinIcon } from "@/components/CoinIcon";
import { coins } from "@/lib/fmt";

interface Money {
  cents: number;
  fmt: string;
}
interface TrendPoint {
  day: string;
  value: number;
}
interface FinancialData {
  overview: {
    platform: Record<string, Money>;
    player: Record<string, Money>;
    playerMeta: {
      pendingDepositsUsdt: number;
      pendingDepositsCount: number;
      pendingWithdrawalsCount: number;
    };
  };
  feeAnalytics: {
    today: { collectedFmt: string; count: number };
    week: { collectedFmt: string; count: number };
    month: { collectedFmt: string; count: number };
    allTime: { collectedFmt: string; count: number };
    feePercent: number | null;
    feeType: string;
    averageFeeFmt: string;
    effectiveFeeRate: number | null;
  };
  trends: {
    profit: TrendPoint[];
    revenue: TrendPoint[];
    deposits: TrendPoint[];
    withdrawals: TrendPoint[];
  };
  houseProfit: {
    betFeesFmt: string;
    playerLossesNetFmt: string;
    playerWinningsNetFmt: string;
    referralPaidFmt: string;
    vipPaidFmt: string;
    manualAdjFmt: string;
    houseProfitFmt: string;
  };
}

// Card labels for the two Financial Overview groups (Part 1), in display order.
const PLATFORM_FIELDS: { key: string; label: string; accent: string }[] = [
  { key: "totalProfit", label: "Total Profit", accent: "text-game-green" },
  { key: "houseBalance", label: "House Balance", accent: "text-game-gold" },
  { key: "todaysProfit", label: "Today's Profit", accent: "text-game-green" },
  { key: "weeklyProfit", label: "Weekly Profit", accent: "text-game-green" },
  { key: "monthlyProfit", label: "Monthly Profit", accent: "text-game-green" },
  { key: "totalBettingFees", label: "Total Betting Fees", accent: "text-game-gold" },
  { key: "totalWithdrawalFees", label: "Total Withdrawal Fees", accent: "text-game-gold" },
  { key: "referralCommissionPaid", label: "Referral Commission Paid", accent: "text-game-red-bright" },
  { key: "vipBonusPaid", label: "VIP Bonus Paid", accent: "text-game-red-bright" },
  { key: "currentPlatformBalance", label: "Current Platform Balance", accent: "text-royal-blue-bright" },
  { key: "netRevenue", label: "Net Revenue", accent: "text-game-green" },
  { key: "availableCash", label: "Available Cash", accent: "text-royal-blue-bright" },
  { key: "lockedCash", label: "Locked Cash", accent: "text-game-violet" },
];

const PLAYER_FIELDS: { key: string; label: string; accent: string }[] = [
  { key: "totalDeposits", label: "Total User Deposits", accent: "text-game-green" },
  { key: "totalWithdrawals", label: "Total User Withdrawals", accent: "text-royal-blue-bright" },
  { key: "currentWalletBalances", label: "Current Wallet Balances", accent: "text-game-gold" },
  { key: "pendingWithdrawals", label: "Pending Withdrawals", accent: "text-game-red-bright" },
  { key: "totalBets", label: "Total Bets", accent: "text-[#111111]" },
  { key: "totalWinnings", label: "Total Winnings", accent: "text-game-green" },
  { key: "totalLosses", label: "Total Losses", accent: "text-game-red-bright" },
  { key: "totalActiveBalance", label: "Total Active Balance", accent: "text-game-gold" },
  { key: "referralRewardsPending", label: "Referral Rewards Pending", accent: "text-game-violet" },
  { key: "vipRewardsPending", label: "VIP Rewards Pending", accent: "text-game-violet" },
];

interface HistoryData {
  profit: Array<{ day: string; houseProfitFmt: string }>;
  activity: Array<{
    day: string;
    newUsers: number;
    activeUsers: number;
    depositCount: number;
    withdrawCount: number;
  }>;
}

export function FinancialTab() {
  const [d, setD] = useState<FinancialData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);

  const loadHistory = () => api<HistoryData>("/api/admin/analytics").then((r) => r.ok && setHistory(r.data!));

  useEffect(() => {
    const load = () => api<FinancialData>("/api/admin/financial").then((r) => r.ok && setD(r.data!));
    load();
    loadHistory();
    const t = setInterval(load, 10000); // realtime-ish refresh
    return () => clearInterval(t);
  }, []);

  async function runSnapshot() {
    setSnapBusy(true);
    await api("/api/admin/analytics", { json: {} });
    await loadHistory();
    setSnapBusy(false);
  }

  if (!d)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full rounded-2xl" />
        ))}
      </div>
    );

  const { platform, player, playerMeta } = d.overview;

  return (
    <div className="space-y-6">
      {/* ── Trend charts ── */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <TrendChart title="Profit trend (30d)" data={d.trends.profit} stroke="#22c55e" />
        <TrendChart title="Revenue trend (30d)" data={d.trends.revenue} stroke="#eab308" />
        <TrendChart title="Deposit trend (30d)" data={d.trends.deposits} stroke="#3b82f6" />
        <TrendChart title="Withdrawal trend (30d)" data={d.trends.withdrawals} stroke="#a855f7" />
      </div>

      {/* ── Platform assets ── */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-game-gold">
          Platform assets · money that belongs to the platform
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PLATFORM_FIELDS.map((f) => (
            <MoneyCard key={f.key} label={f.label} value={platform[f.key]?.fmt ?? "0"} accent={f.accent} />
          ))}
        </div>
      </div>

      {/* ── House profit formula (Part 2) ── */}
      <div className="card p-5">
        <h3 className="mb-1 text-sm font-bold text-[#111111]">House profit breakdown</h3>
        <p className="mb-3 text-xs text-slate-500">
          Player Losses + Betting Fees − Player Winnings − Referral − VIP − Manual adjustments. Recomputed live.
        </p>
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <ProfitLine label="Net player losses" value={d.houseProfit.playerLossesNetFmt} sign="+" accent="text-game-green" />
          <ProfitLine label="Betting fees" value={d.houseProfit.betFeesFmt} sign="+" accent="text-game-gold" />
          <ProfitLine label="Net player winnings" value={d.houseProfit.playerWinningsNetFmt} sign="−" accent="text-game-red-bright" />
          <ProfitLine label="Referral rewards paid" value={d.houseProfit.referralPaidFmt} sign="−" accent="text-game-red-bright" />
          <ProfitLine label="VIP bonuses paid" value={d.houseProfit.vipPaidFmt} sign="−" accent="text-game-red-bright" />
          <ProfitLine label="Manual adjustments" value={d.houseProfit.manualAdjFmt} sign="−" accent="text-game-red-bright" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-3">
          <span className="text-sm font-bold text-[#111111]">House Profit</span>
          <span className="flex items-center gap-1.5 text-2xl font-black text-game-green">
            <CoinIcon className="text-game-gold" /> {coins(d.houseProfit.houseProfitFmt)}
          </span>
        </div>
      </div>

      {/* ── Player assets ── */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-royal-blue-bright">
          Player assets · money that belongs to users
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PLAYER_FIELDS.map((f) => (
            <MoneyCard key={f.key} label={f.label} value={player[f.key]?.fmt ?? "0"} accent={f.accent} />
          ))}
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400">Pending Deposits</div>
            <div className="mt-1 text-2xl font-black text-game-gold">
              {playerMeta.pendingDepositsCount}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {playerMeta.pendingDepositsUsdt.toLocaleString()} USDT awaiting
            </div>
          </div>
        </div>
      </div>

      {/* ── Betting fee analytics (Part 3) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-game-gold">Betting fee analytics</div>
          <div className="flex gap-2">
            <a href="/api/admin/financial/fees/export?days=30" className="btn-ghost !py-1.5 text-xs">
              Export 30d CSV
            </a>
            <a href="/api/admin/financial/fees/export" className="btn-ghost !py-1.5 text-xs">
              Export all CSV
            </a>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyCard label="Today" value={d.feeAnalytics.today.collectedFmt} accent="text-game-gold" sub={`${d.feeAnalytics.today.count} fees`} />
          <MoneyCard label="This week" value={d.feeAnalytics.week.collectedFmt} accent="text-game-gold" sub={`${d.feeAnalytics.week.count} fees`} />
          <MoneyCard label="This month" value={d.feeAnalytics.month.collectedFmt} accent="text-game-gold" sub={`${d.feeAnalytics.month.count} fees`} />
          <MoneyCard label="All time" value={d.feeAnalytics.allTime.collectedFmt} accent="text-game-gold" sub={`${d.feeAnalytics.allTime.count} fees`} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400">Fee configuration</div>
            <div className="mt-1 text-lg font-black text-[#111111]">
              {d.feeAnalytics.feePercent != null ? `${d.feeAnalytics.feePercent}%` : d.feeAnalytics.feeType}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Type: {d.feeAnalytics.feeType}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400">Average fee / bet</div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-game-gold">
              <CoinIcon className="text-game-gold" /> {coins(d.feeAnalytics.averageFeeFmt)}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400">Effective fee rate</div>
            <div className="mt-1 text-lg font-black text-game-green">
              {d.feeAnalytics.effectiveFeeRate != null ? `${d.feeAnalytics.effectiveFeeRate}%` : "—"}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Fees ÷ total wagered</div>
          </div>
        </div>
      </div>

      {/* ── Historical daily snapshots (Platform Analytics) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-game-gold">
            Historical daily snapshots
          </div>
          <button onClick={runSnapshot} disabled={snapBusy} className="btn-ghost !py-1.5 text-xs">
            {snapBusy ? "Running…" : "Run snapshot now"}
          </button>
        </div>
        <div className="card overflow-x-auto p-5">
          {!history || history.activity.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No snapshots yet. Run the snapshot job (or the analytics worker) to build history.
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-black/10">
                  <th className="py-2 pr-3">Day</th>
                  <th className="pr-3">House profit</th>
                  <th className="pr-3">New users</th>
                  <th className="pr-3">Active</th>
                  <th className="pr-3">Deposits</th>
                  <th>Withdrawals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {[...history.activity].reverse().map((a) => {
                  const p = history.profit.find((x) => x.day === a.day);
                  return (
                    <tr key={a.day}>
                      <td className="py-2 pr-3 text-slate-300">{a.day}</td>
                      <td className="whitespace-nowrap pr-3 font-semibold text-game-green">
                        <CoinIcon className="text-game-gold" /> {coins(p?.houseProfitFmt ?? "0")}
                      </td>
                      <td className="pr-3 text-slate-300">{a.newUsers}</td>
                      <td className="pr-3 text-slate-300">{a.activeUsers}</td>
                      <td className="pr-3 text-slate-300">{a.depositCount}</td>
                      <td className="text-slate-300">{a.withdrawCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function MoneyCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 flex items-center gap-1.5 text-2xl font-black ${accent}`}>
        <CoinIcon className="text-game-gold" /> {coins(value)}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function ProfitLine({ label, value, sign, accent }: { label: string; value: string; sign: "+" | "−"; accent: string }) {
  return (
    <div className="flex items-center justify-between border-b border-black/5 py-1">
      <span className="text-slate-300">
        <span className={`mr-1 font-bold ${accent}`}>{sign}</span>
        {label}
      </span>
      <span className="flex items-center gap-1 font-semibold text-[#111111]">
        <CoinIcon className="text-game-gold" /> {coins(value)}
      </span>
    </div>
  );
}

// Dependency-free area/line chart. Scales the series to the viewBox; renders a
// filled area under a stroked polyline. Responsive (viewBox + non-uniform scale).
function TrendChart({ title, data, stroke }: { title: string; data: TrendPoint[]; stroke: string }) {
  const W = 300;
  const H = 80;
  const pad = 4;
  const values = data.map((p) => p.value);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const pts = data.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = n > 0 ? `M${x(0)},${H - pad} L${pts.replace(/ /g, " L")} L${x(n - 1)},${H - pad} Z` : "";
  const total = values.reduce((a, b) => a + b, 0);
  const last = values[values.length - 1] ?? 0;

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
        <div className="text-[11px] text-slate-500">Σ {total.toLocaleString()}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-20 w-full">
        <path d={area} fill={stroke} fillOpacity={0.12} />
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 text-right text-[11px] text-slate-500">Latest: {last.toLocaleString()}</div>
    </div>
  );
}
