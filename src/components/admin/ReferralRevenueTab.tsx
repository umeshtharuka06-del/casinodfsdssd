"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { CoinIcon } from "@/components/CoinIcon";
import { coins } from "@/lib/fmt";

interface Data {
  pendingFmt: string;
  pendingCount: number;
  availableFmt: string;
  availableCount: number;
  claimedFmt: string;
  totalPaidFmt: string;
  totalCommissionsFmt: string;
  totalHouseFeeFmt: string;
  totalCount: number;
  releasedTodayFmt: string;
  releasedTodayCount: number;
  topReferrers: { userId: string; username: string; totalFmt: string; bets: number }[];
}

export function ReferralRevenueTab() {
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = () => api<Data>("/api/admin/referral-revenue").then((r) => r.ok && setD(r.data!));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!d)
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full rounded-2xl" />
        ))}
      </div>
    );

  const top = d.topReferrers.filter((r) =>
    q.trim() ? `${r.username} ${r.userId}`.toLowerCase().includes(q.trim().toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending commissions" value={coins(d.pendingFmt)} sub={`${d.pendingCount} bets`} accent="text-accent-orange" />
        <Stat label="Released today" value={coins(d.releasedTodayFmt)} sub={`${d.releasedTodayCount} released`} accent="text-game-green" />
        <Stat label="Total paid (avail + claimed)" value={coins(d.totalPaidFmt)} accent="text-royal-blue-bright" />
        <Stat label="Total revenue share" value={coins(d.totalCommissionsFmt)} sub={`${d.totalCount} bets`} accent="text-[#111111]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available (unclaimed)" value={coins(d.availableFmt)} sub={`${d.availableCount} bets`} accent="text-game-green" />
        <Stat label="Claimed" value={coins(d.claimedFmt)} accent="text-slate-400" />
        <Stat label="House fee generated" value={coins(d.totalHouseFeeFmt)} accent="text-game-gold" />
      </div>

      <div className="card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#111111]">Top referrers (30d revenue share)</h3>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user…"
            className="input !w-auto !py-1.5 text-xs sm:min-w-[180px]"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-black/10">
                <th className="py-2 pr-3">#</th>
                <th className="pr-3">Referrer</th>
                <th className="pr-3">Referred bets</th>
                <th>Revenue share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {top.map((r, i) => (
                <tr key={r.userId}>
                  <td className="py-2.5 pr-3 text-slate-400">{i + 1}</td>
                  <td className="pr-3 font-medium text-slate-100">
                    {r.username}
                    <div className="font-mono text-[10px] text-slate-500">{r.userId.slice(-8).toUpperCase()}</div>
                  </td>
                  <td className="pr-3 tabular-nums text-slate-300">{r.bets.toLocaleString()}</td>
                  <td className="whitespace-nowrap font-semibold text-game-green">
                    <CoinIcon className="text-game-gold" /> {coins(r.totalFmt)}
                  </td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No referral commissions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 flex items-center gap-1.5 text-2xl font-black ${accent}`}>
        <CoinIcon className="text-game-gold" /> {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
