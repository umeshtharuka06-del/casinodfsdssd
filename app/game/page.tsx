"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { usePredictionMode, type PredRound } from "@/lib/use-prediction";
import { useParityGame } from "@/lib/use-parity";
import { formatRoundId } from "@/lib/round-id";
import { CoinIcon } from "@/components/CoinIcon";
import { TrophyIcon, HistoryIcon } from "@/components/icons";
import { AmountInput } from "@/components/AmountInput";
import { coins } from "@/lib/fmt";

const MODES = [
  { key: "PARITY", label: "Parity" },
  { key: "SAPRE", label: "Sapre" },
  { key: "BCONE", label: "Bcone" },
  { key: "EMERD", label: "Emerd" },
] as const;

// Amount presets shown inside the bet modal. Minimum stake is 50 coins.
const PRESETS = [50, 100, 500, 1000, 5000];
const MIN_BET = 50;

interface MyBet {
  id: string;
  selection: string;
  amount: number; // coin-cents (gross)
  amountFmt: string;
  effectiveBet: number; // coin-cents after house fee
  status: string;
  payoutFmt: string;
  period: string;
  result: { digit: number } | null;
  createdAt: string;
}

export default function GamePage() {
  const [mode, setMode] = useState<string>("PARITY");
  const { me, refresh: refreshUser, setBalanceFmt } = useUser();
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [win, setWin] = useState<{ amount: string; digit: number } | null>(null);
  const [betTarget, setBetTarget] = useState<string | null>(null); // opens the bet modal
  const [showBets, setShowBets] = useState(false); // "My Bets" modal
  const seenSettled = useRef<Set<string>>(new Set());

  // Preselect the mode from ?mode= (set by the home game cards).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("mode")?.toUpperCase();
    if (q && MODES.some((m) => m.key === q)) setMode(q);
  }, []);

  const loadMine = useCallback(async () => {
    const res = await api<MyBet[]>(`/api/games/prediction/${mode}/history`);
    if (res.ok) setMyBets(res.data || []);
  }, [mode]);

  // When a round settles (new period opens): refresh bets + balance, detect win.
  const onNewPeriod = useCallback(
    async (settled: PredRound | null) => {
      await Promise.all([loadMine(), refreshUser()]);
      if (!settled?.result) return;
      const res = await api<MyBet[]>(`/api/games/prediction/${mode}/history`);
      if (!res.ok || !res.data) return;
      setMyBets(res.data);
      const wonForRound = res.data.filter(
        (b) =>
          b.period === settled.period &&
          b.status === "WON" &&
          !seenSettled.current.has(b.id)
      );
      wonForRound.forEach((b) => seenSettled.current.add(b.id));
      if (wonForRound.length) {
        const total = wonForRound.reduce(
          (a, b) => a + parseFloat(b.payoutFmt.replace(/,/g, "")),
          0
        );
        setWin({
          amount: total.toLocaleString("en-US", { minimumFractionDigits: 2 }),
          digit: settled.result.digit,
        });
      }
    },
    [loadMine, refreshUser, mode]
  );

  // PARITY runs on its own rebuilt data flow (use-parity.ts); the other modes
  // keep the shared flow. Both hooks stay mounted and the inactive one idles.
  const isParity = mode === "PARITY";
  const parityGame = useParityGame(isParity ? onNewPeriod : undefined, isParity);
  const sharedGame = usePredictionMode(mode, isParity ? undefined : onNewPeriod, !isParity);
  const game = isParity ? parityGame : sharedGame;

  useEffect(() => {
    setBetTarget(null);
    setMsg(null);
    loadMine();
  }, [mode, loadMine]);

  // Actual bet call — unchanged flow to the same API. Called from the modal.
  async function placeBet(selection: string, amount: number): Promise<boolean> {
    setMsg(null);
    const res = await api<{ balanceFmt: string; balance: number }>(
      `/api/games/prediction/${mode}/bet`,
      { json: { selection, amount: Math.round(amount * 100) } }
    );
    if (!res.ok) {
      setMsg({ text: res.error || "Bet failed", ok: false });
      return false;
    }
    setBalanceFmt(res.data!.balanceFmt, res.data!.balance);
    setMsg({ text: `Bet placed: ${labelFor(selection)} · ${amount} coins`, ok: true });
    loadMine();
    return true;
  }

  // Only the bets on the CURRENTLY ACTIVE round (pending).
  const currentBets = game.round
    ? myBets.filter((b) => b.period === game.round!.period && b.status === "PENDING")
    : [];

  const mm = String(Math.floor(game.secsLeft / 60)).padStart(2, "0");
  const ss = String(game.secsLeft % 60).padStart(2, "0");
  const urgent = game.secsLeft <= 10 && game.phase === "BETTING";
  const canBet = game.phase === "BETTING";

  // Tapping a colour or number opens the bet modal (777-style flow).
  function tap(selection: string) {
    if (!canBet) {
      setMsg({ text: "Betting is closed — wait for the next round.", ok: false });
      return;
    }
    setMsg(null);
    setBetTarget(selection);
  }

  return (
    <div className="space-y-4 py-2">
      {/* Mode tabs */}
      <div className="pill-tabs">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`pill-tab ${mode === m.key ? "pill-tab-active" : ""}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Game card */}
      <div className="card p-4">
        {/* Top row: recent results + My Bets */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-royal-blue/20 text-sm font-bold text-royal-blue-bright">
              ?
            </span>
            <div className="flex gap-1.5">
              {game.history.slice(0, 5).map((h) => (
                <DigitBall key={h.id} digit={h.result?.digit ?? null} size="sm" />
              ))}
            </div>
          </div>
          {me && (
            <button
              onClick={() => setShowBets(true)}
              className="flex items-center gap-1.5 rounded-lg bg-royal-blue px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 active:scale-95"
            >
              <HistoryIcon className="h-4 w-4" /> My Bets
            </button>
          )}
        </div>

        {/* Join buttons */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <button
            onClick={() => tap("GREEN")}
            disabled={!canBet}
            className="btn-green !rounded-lg !py-3 text-sm"
          >
            Join Green
          </button>
          <button
            onClick={() => tap("VIOLET")}
            disabled={!canBet}
            className="btn-violet !rounded-lg !py-3 text-sm"
          >
            Join Violet
          </button>
          <button
            onClick={() => tap("RED")}
            disabled={!canBet}
            className="btn-red !rounded-lg !py-3 text-sm"
          >
            Join Red
          </button>
        </div>

        {/* Numbers 0–9 */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, d) => (
            <button
              key={d}
              onClick={() => tap(String(d))}
              disabled={!canBet}
              className="grid h-12 place-items-center rounded-lg text-lg font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-45 disabled:active:scale-100"
              style={{ background: numberBg(d) }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Period + countdown */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-medium text-slate-400">Period</div>
            <div className="font-display text-lg font-bold tabular-nums text-royal-blue-bright">
              {game.round?.displayPeriod ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">
              {game.phase === "BETTING"
                ? "Count Down"
                : game.phase === "LOCKED"
                ? "Drawing"
                : "Loading"}
            </div>
            <div
              className={`font-display text-lg font-bold tabular-nums ${
                urgent ? "animate-pulse-glow text-game-red" : "text-[#111111]"
              }`}
            >
              {mm}:{ss}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-game-green to-royal-blue transition-all duration-300"
            style={{ width: `${game.progress * 100}%` }}
          />
        </div>

        {msg && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-sm ${
              msg.ok ? "bg-game-green/15 text-game-green" : "bg-game-red/15 text-game-red"
            }`}
          >
            {msg.text}
          </div>
        )}

        {!me && (
          <Link href="/login?next=/game" className="btn-blue mt-3 w-full">
            Log in to play
          </Link>
        )}
      </div>

      {/* Current bets — only the active round's pending bet(s). */}
      {me && currentBets.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold">Current bet</div>
          <div className="space-y-2">
            {currentBets.map((b) => (
              <div
                key={b.id}
                className="well flex animate-slide-up items-center gap-3 px-3 py-3"
              >
                <SelectionBadge selection={b.selection} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{labelFor(b.selection)}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    Stake <CoinIcon className="text-game-gold" /> {coins(b.amountFmt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-sm font-semibold text-game-green">
                    +<CoinIcon className="text-game-gold" /> {coins(potentialWin(b))}
                  </div>
                  <div className="text-[11px] text-royal-blue-bright">Waiting…</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Round history */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{modeLabel(mode)} record</div>
          <span className="text-[11px] text-slate-500">Newest first</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[rgba(45,57,135,0.18)]">
          <div className="tbl-head grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide">
            <span>Period</span>
            <span className="text-center">Number</span>
            <span className="w-14 text-right">Result</span>
          </div>
          <div className="divide-y divide-[rgba(45,57,135,0.25)]">
            {game.history.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="tbl-row px-3 py-2.5">
                    <div className="skeleton h-5 w-full" />
                  </div>
                ))
              : game.history.map((h) => (
                  <div
                    key={h.period}
                    className="tbl-row grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5"
                  >
                    <span className="font-mono text-xs font-semibold text-[#111111]">
                      {h.displayPeriod}
                    </span>
                    <span className="flex justify-center">
                      <DigitBall digit={h.result?.digit ?? null} size="sm" />
                    </span>
                    <span className="flex w-14 justify-end gap-1">
                      {(h.result?.colors ?? []).map((c) => (
                        <span
                          key={c}
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ background: dotColor(c) }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Bet modal — opens AFTER tapping a colour/number (777-style flow) */}
      {betTarget && (
        <BetModal
          selection={betTarget}
          balanceFmt={me?.balanceFmt ?? null}
          canBet={canBet}
          loggedIn={!!me}
          onClose={() => setBetTarget(null)}
          onConfirm={async (amount) => {
            const ok = await placeBet(betTarget, amount);
            if (ok) setBetTarget(null);
          }}
        />
      )}

      {/* My Bets modal */}
      {showBets && (
        <MyBetsModal initialMode={mode} onClose={() => setShowBets(false)} />
      )}

      {/* Win overlay */}
      {win && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-6 animate-fade-in"
          onClick={() => setWin(null)}
        >
          <div className="card-raised w-full max-w-xs animate-win-burst p-6 text-center">
            <TrophyIcon className="mx-auto h-12 w-12 text-mega-gold" />
            <div className="mt-2 text-lg font-bold text-game-green">You won!</div>
            <div className="mt-1 text-sm text-slate-300">
              Result was <span className="font-bold text-[#111111]">{win.digit}</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-3xl font-extrabold text-game-green">
              + <CoinIcon /> {coins(win.amount)}
            </div>
            <button onClick={() => setWin(null)} className="btn-blue mt-5 w-full">
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Bet modal ───────────────────────────── */

function BetModal({
  selection,
  balanceFmt,
  canBet,
  loggedIn,
  onClose,
  onConfirm,
}: {
  selection: string;
  balanceFmt: string | null;
  canBet: boolean;
  loggedIn: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState<number | null>(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const invalid = amount === null || amount < MIN_BET;

  const isColor = ["GREEN", "RED", "VIOLET"].includes(selection);
  const headerBg = isColor
    ? selection === "GREEN"
      ? "#4C6C06"
      : selection === "RED"
      ? "#D81E2C"
      : "#8B5CF6"
    : numberBg(Number(selection));
  const confirmCls = isColor
    ? selection === "GREEN"
      ? "btn-green"
      : selection === "RED"
      ? "btn-red"
      : "btn-violet"
    : "btn-blue";

  async function confirm() {
    if (invalid || busy) return;
    setBusy(true);
    await onConfirm(amount!);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 animate-fade-in sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white animate-slide-up sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored header */}
        <div className="px-5 py-4 text-white" style={{ background: headerBg }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold">
                {isColor ? `Join ${labelFor(selection)}` : `Select ${selection}`}
              </div>
              <div className="text-xs text-white/85">
                Pays {payoutHint(selection)} on the effective stake
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white transition active:scale-90"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Presets */}
          <div>
            <div className="mb-2 text-xs text-slate-400">Amount</div>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition active:scale-95 ${
                    amount === v
                      ? "bg-royal-blue text-white"
                      : "bg-[#FFEFA8] text-slate-300 hover:bg-[#F5E39A]"
                  }`}
                >
                  {v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <div className="mb-1 text-xs text-slate-400">Custom amount</div>
            <AmountInput
              value={amount}
              onChange={setAmount}
              min={MIN_BET}
              placeholder={`Min ${MIN_BET} coins`}
              warning={`Minimum bet is ${MIN_BET} coins.`}
            />
          </div>

          {/* Balance */}
          {balanceFmt && (
            <div className="well flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-slate-400">Balance</span>
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                <CoinIcon className="text-game-gold" /> {coins(balanceFmt)}
              </span>
            </div>
          )}

          {/* Confirm */}
          {!loggedIn ? (
            <Link href="/login?next=/game" className="btn-blue w-full">
              Log in to play
            </Link>
          ) : (
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <button onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={busy || invalid || !canBet}
                className={`${confirmCls} !py-3.5 text-base`}
              >
                {busy
                  ? "Placing…"
                  : !canBet
                  ? "Betting closed"
                  : invalid
                  ? "Enter amount"
                  : `Confirm · ${amount} coins`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── My Bets modal ───────────────────────────── */

const PAGE_SIZE = 8;

function MyBetsModal({
  initialMode,
  onClose,
}: {
  initialMode: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialMode);
  const [bets, setBets] = useState<MyBet[] | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setBets(null);
    setPage(0);
    setOpen(null);
    api<MyBet[]>(`/api/games/prediction/${tab}/history`).then(
      (r) => r.ok && setBets(r.data || [])
    );
  }, [tab]);

  const pages = Math.max(1, Math.ceil((bets?.length ?? 0) / PAGE_SIZE));
  const rows = useMemo(
    () => (bets ?? []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [bets, page]
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 animate-fade-in sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white animate-slide-up sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="text-base font-bold">My Bets</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.07] text-slate-300 transition active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="pill-tabs">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setTab(m.key)}
                className={`pill-tab !py-1.5 !text-xs ${tab === m.key ? "pill-tab-active" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto px-4 py-3">
          {bets === null ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No {modeLabel(tab)} bets yet.
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              {rows.map((b) => {
                const expanded = open === b.id;
                const won = b.status === "WON";
                const lost = b.status === "LOST";
                return (
                  <div key={b.id}>
                    <button
                      onClick={() => setOpen(expanded ? null : b.id)}
                      className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-3 text-left"
                    >
                      <span className="font-mono text-xs text-slate-300">
                        {formatRoundId(tab, b.period)}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          won
                            ? "text-game-green"
                            : lost
                            ? "text-game-red"
                            : "text-royal-blue-bright"
                        }`}
                      >
                        {won ? "win" : lost ? "lose" : "pending"}
                      </span>
                      <span
                        className={`text-right text-sm font-semibold tabular-nums ${
                          won ? "text-game-green" : lost ? "text-game-red" : "text-slate-300"
                        }`}
                      >
                        {won ? `+${coins(b.payoutFmt)}` : lost ? `-${coins(b.amountFmt)}` : coins(b.amountFmt)}
                      </span>
                      <span
                        className={`text-slate-500 transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </button>
                    {expanded && (
                      <div className="well mb-3 space-y-1.5 px-3 py-3 text-xs">
                        <DetailRow label="Selection" value={labelFor(b.selection)} />
                        <DetailRow label="Bet amount" value={`${coins(b.amountFmt)} coins`} />
                        <DetailRow
                          label="Result"
                          value={b.result ? `Number ${b.result.digit}` : "Waiting for draw"}
                        />
                        <DetailRow
                          label={won ? "Payout" : "Status"}
                          value={
                            won
                              ? `+${coins(b.payoutFmt)} coins`
                              : lost
                              ? "Lost"
                              : "Pending"
                          }
                          strong={won}
                        />
                        <DetailRow
                          label="Time"
                          value={new Date(b.createdAt).toLocaleString()}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4 border-t border-black/5 px-4 py-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="grid h-8 w-8 place-items-center rounded-lg bg-black/5 text-slate-300 transition active:scale-90 disabled:opacity-40"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-xs text-slate-400">
            {page + 1}/{pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="grid h-8 w-8 place-items-center rounded-lg bg-black/5 text-slate-300 transition active:scale-90 disabled:opacity-40"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={strong ? "font-semibold text-game-green" : "text-slate-200"}>
        {value}
      </span>
    </div>
  );
}

/* ───────────────────────── helpers & sub-components ───────────────────────── */

function modeLabel(mode: string) {
  return (
    MODES.find((m) => m.key === mode)?.label ?? mode.charAt(0) + mode.slice(1).toLowerCase()
  );
}
function labelFor(sel: string) {
  if (sel === "VIOLET") return "Violet"; // display label only; backend value unchanged
  if (sel === "RED" || sel === "GREEN")
    return sel.charAt(0) + sel.slice(1).toLowerCase();
  return `Number ${sel}`;
}
function payoutHint(sel: string) {
  if (sel === "VIOLET") return "4.5×";
  if (sel === "RED" || sel === "GREEN") return "2× (1.5× on 0/5)";
  return "9×";
}
/** Potential win for a pending bet, computed on the post-fee effective stake. */
function potentialWin(b: MyBet): string {
  const mult =
    b.selection === "VIOLET"
      ? 4.5
      : b.selection === "RED" || b.selection === "GREEN"
      ? 2
      : 9;
  return (Math.floor(b.effectiveBet * mult) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function dotColor(c: string) {
  return c === "RED" ? "#D81E2C" : c === "GREEN" ? "#4C6C06" : "#8B5CF6";
}
// Solid flat colours; 0 and 5 keep the hard two-colour split (functional
// indicator that they pay out on purple + red / purple + green).
function numberBg(d: number) {
  if (d === 0) return "linear-gradient(135deg, #8B5CF6 0 50%, #D81E2C 50% 100%)";
  if (d === 5) return "linear-gradient(135deg, #8B5CF6 0 50%, #4C6C06 50% 100%)";
  return d % 2 === 0 ? "#D81E2C" : "#4C6C06";
}

function DigitBall({
  digit,
  size = "md",
}: {
  digit: number | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-base";
  return (
    <span
      className={`grid ${dim} place-items-center rounded-full font-bold text-white shadow`}
      style={{ background: digit === null ? "#CBB86A" : numberBg(digit) }}
    >
      {digit ?? "?"}
    </span>
  );
}

function SelectionBadge({ selection }: { selection: string }) {
  if (selection === "RED" || selection === "GREEN" || selection === "VIOLET") {
    return (
      <span
        className="grid h-9 w-9 place-items-center rounded-xl text-[10px] font-bold text-white"
        style={{ background: dotColor(selection) }}
      >
        {selection[0]}
      </span>
    );
  }
  return <DigitBall digit={Number(selection)} />;
}
