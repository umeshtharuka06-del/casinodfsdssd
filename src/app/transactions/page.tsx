"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "@/components/CoinIcon";
import { coins } from "@/lib/fmt";

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated transaction centre: wallet ledger + deposit history + withdrawal
// history in one place with filters, search and pagination. Mobile-first rows,
// widening into a table-like layout on larger screens.
// ─────────────────────────────────────────────────────────────────────────────

interface LedgerTxn {
  id: string;
  type: string;
  amountFmt: string;
  amount: number;
  createdAt: string;
}
interface DepositRow {
  id: string;
  amountUsdt: number;
  coinsFmt: string;
  txid: string | null;
  status: string;
  createdAt: string;
}
interface WithdrawalRow {
  id: string;
  coinsFmt: string;
  usdt: number;
  receiveUsdt: number;
  address: string;
  status: string;
  txid: string | null;
  createdAt: string;
}

/** One normalised row for the unified list. */
interface Row {
  id: string;
  kind: "LEDGER" | "DEPOSIT" | "WITHDRAWAL";
  label: string;
  detail: string;
  amountFmt: string;
  positive: boolean;
  status: string | null;
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

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-royal-blue/15 text-royal-blue-bright",
  APPROVED: "bg-game-green/15 text-game-green",
  COMPLETED: "bg-game-green/15 text-game-green",
  REJECTED: "bg-game-red/15 text-game-red-bright",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "wallet", label: "Wallet" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const PAGE_SIZE = 12;

export default function TransactionsPage() {
  const { me, loading } = useUser();
  const router = useRouter();
  const [ledger, setLedger] = useState<LedgerTxn[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!loading && !me) router.replace("/login?next=/transactions");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    const [w, d, wd] = await Promise.all([
      api<{ transactions: LedgerTxn[] }>("/api/wallet"),
      api<DepositRow[]>("/api/crypto/deposits"),
      api<WithdrawalRow[]>("/api/crypto/withdrawals"),
    ]);
    if (w.ok && w.data) setLedger(w.data.transactions);
    if (d.ok && d.data) setDeposits(d.data);
    if (wd.ok && wd.data) setWithdrawals(wd.data);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [me, load]);

  // Normalise the three sources into one sortable list.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (filter === "all" || filter === "wallet") {
      for (const t of ledger) {
        out.push({
          id: `L${t.id}`,
          kind: "LEDGER",
          label: LABEL[t.type] || t.type,
          detail: "",
          amountFmt: t.amountFmt,
          positive: t.amount >= 0,
          status: null,
          createdAt: t.createdAt,
        });
      }
    }
    if (filter === "all" || filter === "deposits") {
      for (const d of deposits) {
        out.push({
          id: `D${d.id}`,
          kind: "DEPOSIT",
          label: `Deposit · ${d.amountUsdt} USDT`,
          detail: d.txid ? `${d.txid.slice(0, 10)}…${d.txid.slice(-6)}` : "",
          amountFmt: d.coinsFmt,
          positive: true,
          status: d.status,
          createdAt: d.createdAt,
        });
      }
    }
    if (filter === "all" || filter === "withdrawals") {
      for (const w of withdrawals) {
        out.push({
          id: `W${w.id}`,
          kind: "WITHDRAWAL",
          label: `Withdrawal · ${w.receiveUsdt.toFixed(2)} USDT`,
          detail: `${w.address.slice(0, 8)}…${w.address.slice(-6)}`,
          amountFmt: w.coinsFmt,
          positive: false,
          status: w.status,
          createdAt: w.createdAt,
        });
      }
    }
    out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const needle = q.trim().toLowerCase();
    if (!needle) return out;
    return out.filter(
      (r) =>
        r.label.toLowerCase().includes(needle) ||
        r.detail.toLowerCase().includes(needle) ||
        (r.status ?? "").toLowerCase().includes(needle)
    );
  }, [ledger, deposits, withdrawals, filter, q]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [filter, q]);

  if (!me) {
    return (
      <div className="space-y-3 py-2">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-[#1D1D1F]">Transactions</h1>
        <Link href="/mine" className="text-xs font-semibold text-royal-blue-bright">
          ← Back
        </Link>
      </div>

      {/* Coin balance */}
      <div className="card flex items-center justify-between p-4">
        <span className="text-sm text-slate-400">Coin balance</span>
        <span className="flex items-center gap-1.5 text-lg font-bold tabular-nums text-[#111111]">
          <CoinIcon /> {coins(me.balanceFmt)}
        </span>
      </div>

      {/* Filters + search */}
      <div className="card space-y-3 p-4">
        <div className="pill-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`pill-tab ${filter === f.key ? "pill-tab-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            ⌕
          </span>
          <input
            className="input !pl-9"
            placeholder="Search by type, status, TXID or address…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="card p-4">
        {busy ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No transactions found.
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {pageRows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-200">
                    {r.label}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <span>{new Date(r.createdAt).toLocaleString()}</span>
                    {r.detail && <span className="font-mono">{r.detail}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`flex items-center justify-end gap-1 text-sm font-bold tabular-nums ${
                      r.positive ? "text-game-green" : "text-slate-300"
                    }`}
                  >
                    {r.positive ? "+" : "−"}
                    <CoinIcon /> {coins(r.amountFmt).replace(/^-/, "")}
                  </div>
                  {r.status && (
                    <span
                      className={`chip mt-0.5 ${STATUS_CLS[r.status] ?? "bg-black/5 text-slate-400"}`}
                    >
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {rows.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-ghost !py-2 text-xs"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost !py-2 text-xs"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
