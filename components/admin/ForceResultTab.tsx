"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

interface SideStat {
  coins: number;
  players: number;
}
interface RoundStats {
  players: number;
  totalCoins: number;
  colors: Record<string, SideStat>;
  digits: Record<string, SideStat>;
  frozen: boolean;
}
interface PendingRound {
  id: string;
  roundId: string;
  game: string;
  state: string;
  bets: number;
  forcedResult: { color?: string; digit?: number } | null;
  lockAt: string;
  stats: RoundStats;
}

const COLORS = ["RED", "GREEN", "VIOLET"] as const;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const COLOR_CLS: Record<string, string> = {
  RED: "bg-game-red text-white",
  GREEN: "bg-game-green text-white",
  VIOLET: "bg-game-violet text-white",
};

const COLOR_LABEL: Record<string, string> = {
  RED: "Red",
  GREEN: "Green",
  VIOLET: "Violet",
};

function fmtCoins(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function ForceResultTab() {
  const [rounds, setRounds] = useState<PendingRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<PendingRound[]>("/api/admin/games/force");
    if (res.ok) setRounds(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Reuse a single 5s poll for both the round list and the live betting stats
    // — no per-second network polling.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    // Local clock only (no network) — drives the countdown display.
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function force(r: PendingRound, payload: { color?: string; digit?: number }) {
    const res = await api(`/api/admin/games/force`, {
      json: { roundId: r.id, game: r.game, ...payload },
    });
    setMsg({
      text: res.ok
        ? `Forced #${r.roundId} (${r.game}) → ${payload.color ?? payload.digit}`
        : res.error || "Failed to force result",
      ok: res.ok,
    });
    load();
  }

  async function clear(r: PendingRound) {
    const res = await api(`/api/admin/games/force?roundId=${r.id}`, { method: "DELETE" });
    setMsg({ text: res.ok ? `Cleared override on #${r.roundId}` : res.error || "Failed", ok: res.ok });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-400">
        Choose the winning <b className="text-slate-200">colour</b> or{" "}
        <b className="text-slate-200">number</b> for any open round. The engine uses
        your choice when the round settles, overriding the automatic house logic for
        that round only. Each card shows a <b className="text-slate-200">live betting
        breakdown</b> that freezes once betting closes.
      </div>

      {msg && (
        <div
          className={`card p-3 text-sm ${
            msg.ok ? "text-game-green" : "text-game-red-bright"
          }`}
        >
          {msg.text}
        </div>
      )}

      {loading && rounds.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : rounds.length === 0 ? (
        <div className="card p-6 text-sm text-slate-400">
          No open rounds right now. They appear here once a betting window opens.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rounds.map((r) => {
            const secsLeft = Math.max(0, Math.ceil((new Date(r.lockAt).getTime() - now) / 1000));
            const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
            const ss = String(secsLeft % 60).padStart(2, "0");
            return (
              <div key={r.id} className="card flex flex-col gap-4 p-5">
                {/* Header: game + round id + countdown */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-black text-[#111111]">{r.game}</div>
                    <div className="font-mono text-xs text-slate-400">#{r.roundId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                      Closes in
                    </div>
                    <div
                      className={`font-mono text-lg font-black tabular-nums ${
                        secsLeft <= 10 ? "text-game-red-bright" : "text-[#111111]"
                      }`}
                    >
                      {mm}:{ss}
                    </div>
                  </div>
                </div>

                {/* Meta: bets + forced */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-black/5 text-slate-300">{r.state}</span>
                  <span className="chip bg-black/5 text-slate-300">{r.bets} bets</span>
                  {r.forcedResult && (
                    <span className="chip bg-game-green/15 text-game-green">
                      Forced → {r.forcedResult.color ?? r.forcedResult.digit}
                    </span>
                  )}
                </div>

                {/* Live betting breakdown */}
                <BettingBreakdown stats={r.stats} />

                {/* Colour buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => force(r, { color: c })}
                      className={`rounded-xl py-2 text-xs font-bold transition active:scale-95 ${
                        COLOR_CLS[c]
                      } ${r.forcedResult?.color === c ? "ring-2 ring-white" : "opacity-90"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Digit buttons */}
                <div className="grid grid-cols-5 gap-2">
                  {DIGITS.map((d) => (
                    <button
                      key={d}
                      onClick={() => force(r, { digit: d })}
                      className={`grid aspect-square place-items-center rounded-xl bg-[#FFF6CC] text-sm font-bold text-[#111111] transition active:scale-95 ${
                        r.forcedResult?.digit === d ? "ring-2 ring-game-green" : ""
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {r.forcedResult && (
                  <button onClick={() => clear(r)} className="btn-ghost !py-2 text-xs">
                    Clear override
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Admins-only live betting summary + breakdown table inside each round card. */
function BettingBreakdown({ stats }: { stats: RoundStats }) {
  return (
    <div className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
      {/* Top-line summary */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Live betting
        </div>
        <span
          className={`chip text-[10px] ${
            stats.frozen ? "bg-black/10 text-slate-500" : "bg-game-green/15 text-game-green"
          }`}
        >
          {stats.frozen ? "Frozen" : "Live"}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white/60 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-500">Players</div>
          <div className="font-bold text-[#111111]">{stats.players}</div>
        </div>
        <div className="rounded-lg bg-white/60 px-2 py-1.5">
          <div className="text-[10px] uppercase text-slate-500">Total bet</div>
          <div className="font-bold text-game-gold">{fmtCoins(stats.totalCoins)}</div>
        </div>
      </div>

      {/* Colour breakdown */}
      <div className="mb-2 space-y-1">
        {COLORS.map((c) => (
          <div key={c} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  c === "RED" ? "bg-game-red" : c === "GREEN" ? "bg-game-green" : "bg-game-violet"
                }`}
              />
              <span className="font-medium text-slate-300">{COLOR_LABEL[c]}</span>
            </span>
            <span className="text-slate-400">
              <b className="text-slate-200">{stats.colors[c]?.players ?? 0}</b> players ·{" "}
              <b className="text-game-gold">{fmtCoins(stats.colors[c]?.coins ?? 0)}</b> coins
            </span>
          </div>
        ))}
      </div>

      {/* Number breakdown */}
      <div className="mt-2 border-t border-black/10 pt-2">
        <div className="mb-1 text-[10px] uppercase text-slate-500">Numbers</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          {DIGITS.map((d) => {
            const s = stats.digits[String(d)] ?? { coins: 0, players: 0 };
            return (
              <div key={d} className="flex items-center justify-between">
                <span className="font-mono font-medium text-slate-300">{d}</span>
                <span className="text-slate-400">
                  <b className="text-slate-200">{s.players}</b> ·{" "}
                  <b className="text-game-gold">{fmtCoins(s.coins)}</b>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
