"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { CoinIcon } from "@/components/CoinIcon";
import { DataTable, type Column } from "./DataTable";
import { coins } from "@/lib/fmt";

// ─────────────────────────────────────────────────────────────────────────────
// Manual Deposit Reviews — the queue of deposits that cannot be verified
// automatically. Primarily OFFCHAIN references (exchange/internal transfers);
// the type filter also lets reviewers audit on-chain requests. Approving
// credits the balance, writes the ledger row and notifies the operator channel
// (all via the shared approveDeposit path). Rejecting an off-chain deposit
// REQUIRES a reason.
// ─────────────────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  user: string;
  uid: string;
  amountUsdt: number;
  coinsFmt: string;
  wallet: string;
  walletAddress: string;
  network: string;
  txType: string;
  txid: string | null;
  confirmations: number;
  status: string;
  note: string | null;
  createdAt: string;
}

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
const TYPE_FILTERS = ["OFFCHAIN", "ONCHAIN", "ALL"] as const;
const BADGE: Record<string, string> = {
  PENDING: "bg-royal-blue/15 text-royal-blue-bright",
  APPROVED: "bg-game-green/15 text-game-green",
  REJECTED: "bg-game-red/15 text-game-red-bright",
};

export function ManualReviewsTab({ focusId }: { focusId?: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("PENDING");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("OFFCHAIN");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (type !== "ALL") params.set("type", type);
    const r = await api<Row[]>(`/api/admin/crypto/deposits?${params.toString()}`);
    if (r.ok) setRows(r.data || []);
    setLoading(false);
  }, [status, type]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 8000); // live queue
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "approve" | "reject", current: Row) {
    let txid: string | undefined;
    let note: string | undefined;
    if (action === "approve" && current.txType === "ONCHAIN" && !current.txid) {
      const v = window.prompt("On-chain TXID (optional — leave blank to approve manually):");
      if (v === null) return;
      txid = v.trim() || undefined;
    }
    if (action === "approve") {
      const v = window.prompt("Review note (optional):");
      if (v === null) return;
      note = v.trim() || undefined;
    }
    if (action === "reject") {
      const required = current.txType === "OFFCHAIN";
      const v = window.prompt(required ? "Rejection reason (required):" : "Reason (optional):");
      if (v === null) return;
      note = v.trim() || undefined;
      if (required && !note) {
        window.alert("A rejection reason is required for off-chain deposits.");
        return;
      }
    }
    setBusy(id + action);
    const r = await api("/api/admin/crypto/deposits", { json: { id, action, txid, note } });
    setBusy("");
    if (!r.ok) window.alert(r.error || "Action failed.");
    load();
  }

  const columns: Column<Row>[] = [
    { key: "user", label: "User", sort: (r) => r.user, render: (r) => <span className="font-medium text-slate-100">{r.user}</span> },
    {
      key: "amount",
      label: "Amount",
      sort: (r) => r.amountUsdt,
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.amountUsdt} USDT <span className="text-slate-500">·</span>{" "}
          <span className="text-game-gold"><CoinIcon /> {coins(r.coinsFmt)}</span>
        </span>
      ),
    },
    {
      key: "txType",
      label: "Type",
      sort: (r) => r.txType,
      render: (r) => (
        <span
          className={`chip ${
            r.txType === "OFFCHAIN"
              ? "bg-game-violet/15 text-game-violet"
              : "bg-royal-blue/15 text-royal-blue-bright"
          }`}
        >
          {r.txType === "OFFCHAIN" ? "Off-chain" : "On-chain"}
        </span>
      ),
    },
    {
      key: "wallet",
      label: "Wallet",
      sort: (r) => r.wallet,
      csv: (r) => `${r.wallet} ${r.walletAddress}`,
      render: (r) => (
        <div className="max-w-[150px]">
          <div className="text-xs text-slate-200">{r.wallet}</div>
          <div className="truncate font-mono text-[10px] text-slate-500" title={r.walletAddress}>{r.walletAddress}</div>
        </div>
      ),
    },
    {
      key: "txid",
      label: "TXID / Reference",
      csv: (r) => r.txid ?? "",
      render: (r) =>
        r.txid ? (
          r.txType === "OFFCHAIN" ? (
            <span className="max-w-[140px] truncate font-mono text-[10px] text-slate-300" title={r.txid}>
              {r.txid}
            </span>
          ) : (
            <a href={`https://tronscan.org/#/transaction/${r.txid}`} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-royal-blue-bright">
              {r.txid.slice(0, 8)}…{r.confirmations ? ` (${r.confirmations})` : ""}
            </a>
          )
        ) : (
          <span className="text-[11px] text-slate-600">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      sort: (r) => r.status,
      render: (r) => (
        <div>
          <span className={`chip ${BADGE[r.status] ?? "bg-black/5 text-slate-300"}`}>{r.status}</span>
          {r.note && (
            <div className="mt-0.5 max-w-[150px] truncate text-[10px] text-slate-500" title={r.note}>
              {r.note}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted",
      sort: (r) => r.createdAt,
      csv: (r) => new Date(r.createdAt).toISOString(),
      render: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      thClassName: "text-right",
      tdClassName: "text-right",
      render: (r) =>
        r.status === "PENDING" ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            <button onClick={() => act(r.id, "approve", r)} disabled={!!busy} className="chip bg-game-green/15 text-game-green">approve</button>
            <button onClick={() => act(r.id, "reject", r)} disabled={!!busy} className="chip bg-game-red/15 text-game-red-bright">reject</button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-600">—</span>
        ),
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatus(f)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              status === f ? "bg-royal-blue text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setType(f)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              type === f ? "bg-game-violet text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {f === "OFFCHAIN" ? "Off-chain" : f === "ONCHAIN" ? "On-chain" : "All types"}
          </button>
        ))}
      </div>
    </div>
  );

  // Highlight support for Telegram deep links (?deposit=<id>).
  const highlight = useCallback(
    (r: Row) => (focusId && r.id === focusId ? "bg-game-gold/10" : ""),
    [focusId]
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowClassName={highlight}
      loading={loading}
      search={(r) => `${r.user} ${r.uid} ${r.txid ?? ""} ${r.walletAddress} ${r.wallet} ${r.txType}`}
      searchPlaceholder="Search user / UID / TXID / reference…"
      dateKey={(r) => r.createdAt}
      filename="manual-deposit-reviews"
      toolbar={toolbar}
      minWidth={1020}
      emptyText="No deposits awaiting manual review."
    />
  );
}
