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
  signalGroup: string;
}
interface Progress {
  level: number;
  depositPct: number;
  depositRemainingUsdt: number;
  referralPct: number | null;
  referralRemaining: number | null;
}
interface VipData {
  enabled: boolean;
  level: number;
  isOverridden: boolean;
  totalDepositUsdt: number;
  qualifiedReferrals: number;
  tiers: Tier[];
  progress: Progress | null;
}

export default function VipPage() {
  const { me, loading } = useUser();
  const [data, setData] = useState<VipData | null>(null);

  useEffect(() => {
    if (me) api<VipData>("/api/me/vip").then((r) => r.ok && setData(r.data!));
  }, [me]);

  if (!loading && !me) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-300">Sign in to view your VIP status.</p>
        <Link href="/login" className="btn-gold mt-3 inline-block !py-2 text-sm">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-game-gold md:text-3xl">VIP Program</h1>
          <p className="text-sm text-slate-400">
            Climb the tiers for exclusive signals, priority support and daily bonuses.
          </p>
        </div>
        <Link href="/deposit" className="btn-gold !py-2 text-sm">
          Deposit
        </Link>
      </div>

      {!data ? (
        <div className="skeleton h-40 w-full rounded-2xl" />
      ) : (
        <>
          {/* Current status */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-400">Your current tier:</span>
              {data.level > 0 ? <VipBadge level={data.level} /> : <span className="chip bg-black/5 text-slate-400">No VIP yet</span>}
              {data.isOverridden && <span className="chip bg-royal-blue/15 text-royal-blue-bright">Set by admin</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Total deposits" value={`$${data.totalDepositUsdt.toLocaleString()}`} />
              <Metric label="Qualified referrals" value={data.qualifiedReferrals.toLocaleString()} />
            </div>

            {/* Progress to next tier */}
            {data.progress ? (
              <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] p-4">
                <div className="mb-2 text-sm font-semibold text-[#111111]">
                  Progress to VIP{data.progress.level}
                </div>
                <ProgressBar label={`Deposit ($${data.progress.depositRemainingUsdt.toLocaleString()} to go)`} pct={data.progress.depositPct} />
                {data.progress.referralPct != null && (
                  <ProgressBar
                    label={`Qualified referrals (${data.progress.referralRemaining} to go)`}
                    pct={data.progress.referralPct}
                  />
                )}
              </div>
            ) : (
              <div className="mt-4 text-sm font-semibold text-game-green">
                🎉 You’ve reached the highest VIP tier. Enjoy every benefit!
              </div>
            )}
          </div>

          {/* All tiers */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.tiers.map((t) => (
              <div
                key={t.level}
                className={`card p-5 ${t.achieved ? "ring-2 ring-game-gold/40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <VipBadge level={t.level} />
                  {t.achieved && <span className="chip bg-game-green/15 text-game-green">Unlocked</span>}
                </div>
                <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">Requirement</div>
                <div className="text-sm font-semibold text-[#111111]">{t.requirement}</div>
                <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">Benefits</div>
                <ul className="mt-1 space-y-1">
                  {t.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-0.5 text-game-gold">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-bold text-[#111111]">{value}</div>
    </div>
  );
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full rounded-full bg-game-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
