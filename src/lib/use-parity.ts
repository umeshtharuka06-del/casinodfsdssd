"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./client";
import type { PredRound } from "./use-prediction";

interface ParityCurrentResp {
  mode: string;
  roundMs: number;
  round: PredRound | null;
  history: PredRound[];
  serverNow: string;
}

/**
 * PARITY — dedicated real-time round state (rebuilt 2026-07).
 *
 * Same architecture as the shared prediction hook the other modes use:
 *  • Countdown is aligned to SERVER time (offset measured from `serverNow`).
 *  • Polling is adaptive — ~400ms in the final seconds / right after lock so
 *    the settled result and the next round appear within a fraction of a
 *    second; a failed poll always reschedules the next one.
 *  • When a new period opens, `onNewPeriod` fires once with the just-settled
 *    round so the page can refresh bets/balance and play the win animation.
 *
 * One deliberate difference: history arrives from /api/games/parity/current
 * already ordered by settlement recency and deduped. This hook only dedupes
 * defensively and MUST NOT re-sort by period — client-side period sorting is
 * what let rounds with foreign-cadence (corrupted) period values pin the top
 * of the old Parity history.
 *
 * `enabled` gates all polling so the hook can idle while another mode's tab
 * is active (hooks cannot be mounted conditionally).
 */
export function useParityGame(
  onNewPeriod?: (settled: PredRound | null) => void,
  enabled = true
) {
  const [data, setData] = useState<ParityCurrentResp | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const offsetRef = useRef(0); // serverNow - clientNow
  const dataRef = useRef<ParityCurrentResp | null>(null);
  const lastPeriod = useRef<string | null>(null);
  const cbRef = useRef(onNewPeriod);
  cbRef.current = onNewPeriod;

  const fetchNow = useCallback(async () => {
    const res = await api<ParityCurrentResp>("/api/games/parity/current");
    if (!res.ok || !res.data) return;
    offsetRef.current = new Date(res.data.serverNow).getTime() - Date.now();
    dataRef.current = res.data;
    setData(res.data);

    const p = res.data.round?.period ?? null;
    if (lastPeriod.current !== null && p !== null && p !== lastPeriod.current) {
      cbRef.current?.(res.data.history[0] ?? null);
    }
    if (p !== null) lastPeriod.current = p;
  }, []);

  // Reset when the hook is disabled (another mode's tab is active) so a later
  // re-enable starts clean and never false-fires onNewPeriod.
  useEffect(() => {
    if (enabled) return;
    lastPeriod.current = null;
    dataRef.current = null;
    setData(null);
  }, [enabled]);

  // Adaptive polling loop. try/finally guarantees the next poll is ALWAYS
  // scheduled — a single rejected fetch must never freeze the round state.
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const serverMs = () => Date.now() + offsetRef.current;

    const loop = async () => {
      let delay = 1500;
      try {
        await fetchNow();
        const d = dataRef.current;
        if (d?.round) {
          const settleLeft = new Date(d.round.settleAt).getTime() - serverMs();
          const lockLeft = new Date(d.round.lockAt).getTime() - serverMs();
          if (settleLeft <= 2500 || (lockLeft <= 0 && settleLeft > 0)) delay = 400;
          else if (settleLeft <= 6000) delay = 900;
        } else {
          delay = 700; // round not opened yet — check back soon
        }
      } catch {
        delay = 1000; // transient error — back off briefly, keep polling
      } finally {
        if (!stopped) timer = setTimeout(loop, delay);
      }
    };

    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [fetchNow, enabled]);

  // Smooth clock for the countdown (server-aligned).
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now() + offsetRef.current), 100);
    return () => clearInterval(t);
  }, [enabled]);

  // Defensive dedupe by canonical period, PRESERVING server order (settlement
  // recency). No re-sort here — see the hook docblock.
  const history = useMemo(() => {
    const raw = data?.history ?? [];
    const seen = new Set<string>();
    const out: PredRound[] = [];
    for (const r of raw) {
      if (seen.has(r.period)) continue;
      seen.add(r.period);
      out.push(r);
    }
    return out;
  }, [data]);

  const round = data?.round ?? null;
  const lockMs = round ? new Date(round.lockAt).getTime() - now : 0;
  const settleMs = round ? new Date(round.settleAt).getTime() - now : 0;
  const locked = lockMs <= 0;
  const secsLeft = Math.max(0, Math.ceil((locked ? settleMs : lockMs) / 1000));
  const phase: "BETTING" | "LOCKED" | "WAITING" = !round
    ? "WAITING"
    : locked
    ? "LOCKED"
    : "BETTING";

  // Fraction of the betting window remaining (for the progress bar).
  let progress = 0;
  if (round) {
    const start = new Date(round.startAt).getTime();
    const lock = new Date(round.lockAt).getTime();
    const span = lock - start || 1;
    progress = Math.max(0, Math.min(1, lockMs / span));
  }

  return {
    data,
    round,
    history,
    roundMs: data?.roundMs ?? 0,
    secsLeft,
    locked,
    phase,
    progress,
    refresh: fetchNow,
  };
}
