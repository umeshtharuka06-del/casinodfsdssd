"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import { CoinIcon } from "@/components/CoinIcon";

// ── Types mirror the /api/admin/users/[id] payload (src/lib/admin-user.ts) ──
interface TreeNode {
  id: string;
  username: string;
  children: TreeNode[];
}
interface Details {
  profile: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    isBanned: boolean;
    createdAt: string;
    updatedAt: string;
  };
  wallet: { balance: number; balanceFmt: string };
  deposits: Array<{
    id: string;
    amountUsdt: number;
    coinsFmt: string;
    status: string;
    toAddress: string | null;
    txid: string | null;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    coinsFmt: string;
    usdt: number;
    receiveUsdt: number;
    address: string;
    status: string;
    txid: string | null;
    createdAt: string;
  }>;
  bets: Array<{
    id: string;
    game: string;
    selection: string;
    amountFmt: string;
    status: string;
    payoutFmt: string;
    createdAt: string;
  }>;
  recentLogins: Array<{ ip: string | null; createdAt: string }>;
  referral: {
    code: string;
    referredBy: { id: string; username: string; email: string; createdAt: string } | null;
    invitedCount: number;
    successfulCount: number;
    rewards: {
      lockedFmt: string;
      availableFmt: string;
      claimedFmt: string;
      pendingFmt: string;
      history: Array<{
        id: string;
        referredUser: string;
        amountFmt: string;
        amountUsdt: number;
        status: "LOCKED" | "AVAILABLE" | "CLAIMED";
        createdAt: string;
        unlockAt: string;
        claimedAt: string | null;
      }>;
    };
    invited: Array<{
      id: string;
      username: string;
      email: string;
      createdAt: string;
      balanceFmt: string;
      status: string;
      firstDepositUsdt: number | null;
      firstDepositAt: string | null;
      deposited: boolean;
      rewarded: boolean;
    }>;
    tree: TreeNode;
  };
}

const fmtDate = (s: string) => new Date(s).toLocaleString();
const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");

const STATUS_CLS: Record<string, string> = {
  APPROVED: "text-game-green",
  COMPLETED: "text-game-green",
  WON: "text-game-green",
  CASHED: "text-game-green",
  PENDING: "text-slate-400",
  REJECTED: "text-game-red-bright",
  LOST: "text-game-red-bright",
};

export function UserDetailsDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<Details | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr("");
    api<Details>(`/api/admin/users/${userId}`).then((res) => {
      if (!alive) return;
      if (res.ok && res.data) setData(res.data);
      else setErr(res.error || "Failed to load user.");
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const referralLink =
    data && typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=${data.referral.code}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#111111]">User details</h2>
            {data && (
              <p className="text-sm text-slate-400">
                {data.profile.username} · {data.profile.email}
              </p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost !py-2 text-sm">
            ✕ Close
          </button>
        </div>

        {err && <div className="card p-4 text-sm text-game-red-bright">{err}</div>}
        {!data && !err && <div className="skeleton h-64 w-full rounded-2xl" />}

        {data && (
          <div className="space-y-5">
            {/* Basic profile */}
            <Section title="Basic profile">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Username" value={data.profile.username} />
                <Field label="Email" value={data.profile.email} />
                <Field label="User ID" value={data.profile.id} mono />
                <Field label="Joined" value={fmtDate(data.profile.createdAt)} />
                <Field label="Role" value={data.profile.isAdmin ? "Admin" : "Player"} />
                <Field label="Status" value={data.profile.isBanned ? "Banned" : "Active"} />
              </dl>
            </Section>

            {/* Wallet / balance */}
            <Section title="Wallet">
              <div className="flex items-center gap-2 text-lg font-black text-game-gold">
                <CoinIcon /> {data.wallet.balanceFmt}
                <span className="text-xs font-medium text-slate-400">coins</span>
              </div>
            </Section>

            {/* Deposit history */}
            <Section title={`Deposit history (${data.deposits.length})`}>
              <Table
                head={["Date", "USDT", "Coins", "Status"]}
                rows={data.deposits.map((d) => [
                  fmtDate(d.createdAt),
                  d.amountUsdt.toString(),
                  d.coinsFmt,
                  <span key="s" className={STATUS_CLS[d.status] ?? ""}>{d.status}</span>,
                ])}
                empty="No deposits."
              />
            </Section>

            {/* Withdrawal history */}
            <Section title={`Withdrawal history (${data.withdrawals.length})`}>
              <Table
                head={["Date", "Coins", "USDT", "Status"]}
                rows={data.withdrawals.map((w) => [
                  fmtDate(w.createdAt),
                  w.coinsFmt,
                  w.usdt.toFixed(2),
                  <span key="s" className={STATUS_CLS[w.status] ?? ""}>{w.status}</span>,
                ])}
                empty="No withdrawals."
              />
            </Section>

            {/* Bet history */}
            <Section title={`Bet history (${data.bets.length})`}>
              <Table
                head={["Date", "Game", "Pick", "Stake", "Result", "Payout"]}
                rows={data.bets.map((b) => [
                  fmtDate(b.createdAt),
                  b.game,
                  b.selection,
                  b.amountFmt,
                  <span key="s" className={STATUS_CLS[b.status] ?? ""}>{b.status}</span>,
                  b.payoutFmt,
                ])}
                empty="No bets."
              />
            </Section>

            {/* Recent logins */}
            <Section title={`Recent logins (${data.recentLogins.length})`}>
              <Table
                head={["Date", "IP"]}
                rows={data.recentLogins.map((l) => [fmtDate(l.createdAt), l.ip ?? "—"])}
                empty="No recorded logins."
              />
            </Section>

            {/* Referral information */}
            <Section title="Referral information">
              <dl className="mb-3 grid grid-cols-1 gap-3 text-sm">
                <CopyField label="Referral code" value={data.referral.code} />
                <CopyField label="Referral link" value={referralLink} />
                <Field
                  label="Invited by"
                  value={
                    data.referral.referredBy
                      ? `${data.referral.referredBy.username} (${data.referral.referredBy.email})`
                      : "— (organic signup)"
                  }
                />
              </dl>

              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Invited users" value={data.referral.invitedCount} />
                <Stat label="Successful referrals" value={data.referral.successfulCount} />
                <Stat label="Pending" value={data.referral.rewards.pendingFmt} coin />
                <Stat label="Available" value={data.referral.rewards.availableFmt} coin />
                <Stat label="Locked" value={data.referral.rewards.lockedFmt} coin />
                <Stat label="Claimed" value={data.referral.rewards.claimedFmt} coin />
              </div>

              {/* Referred users */}
              <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                Referred users
              </div>
              <Table
                head={["User", "Registered", "1st deposit", "Status", "Balance"]}
                rows={data.referral.invited.map((u) => [
                  <div key="u">
                    <div className="font-medium text-slate-200">{u.username}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>,
                  fmtDay(u.createdAt),
                  u.firstDepositUsdt != null
                    ? `${u.firstDepositUsdt} USDT · ${fmtDay(u.firstDepositAt)}`
                    : "—",
                  <span key="s" className={u.status === "Banned" ? "text-game-red-bright" : "text-game-green"}>
                    {u.status}
                  </span>,
                  u.balanceFmt,
                ])}
                empty="No referred users."
              />

              {/* Commission history */}
              <div className="mb-1 mt-3 text-xs font-semibold uppercase text-slate-500">
                Referral commission history
              </div>
              <Table
                head={["Referred", "Amount", "USDT", "Status", "Created", "Unlocks / Claimed"]}
                rows={data.referral.rewards.history.map((r) => [
                  r.referredUser,
                  r.amountFmt,
                  r.amountUsdt.toString(),
                  <span
                    key="s"
                    className={
                      r.status === "CLAIMED"
                        ? "text-game-green"
                        : r.status === "AVAILABLE"
                        ? "text-royal-blue-bright"
                        : "text-slate-400"
                    }
                  >
                    {r.status}
                  </span>,
                  fmtDay(r.createdAt),
                  r.status === "CLAIMED" ? fmtDay(r.claimedAt) : fmtDay(r.unlockAt),
                ])}
                empty="No referral commissions yet."
              />
            </Section>

            {/* Referral tree */}
            <Section title="Referral tree">
              {data.referral.tree.children.length === 0 ? (
                <div className="text-sm text-slate-400">This user has not referred anyone.</div>
              ) : (
                <div className="text-sm">
                  <TreeBranch node={data.referral.tree} depth={0} isRoot />
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Presentational helpers (reuse existing card/chip styling; no redesign) ──

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#111111]">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-slate-500">{label}</dt>
      <dd className={`truncate text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <dt className="text-[10px] uppercase text-slate-500">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="truncate font-mono text-xs text-slate-200">{value}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="chip shrink-0 bg-black/5 text-slate-400"
        >
          {copied ? "✓" : "Copy"}
        </button>
      </dd>
    </div>
  );
}

function Stat({ label, value, coin }: { label: string; value: string | number; coin?: boolean }) {
  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className={`font-bold ${coin ? "text-game-gold" : "text-[#111111]"}`}>{value}</div>
    </div>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <div className="text-sm text-slate-400">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase text-slate-500">
          <tr className="border-b border-black/10">
            {head.map((h) => (
              <th key={h} className="py-1.5 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="py-1.5 pr-3 align-top text-slate-300">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One collapsible branch of the referral tree. */
function TreeBranch({
  node,
  depth,
  isRoot,
}: {
  node: TreeNode;
  depth: number;
  isRoot?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2); // auto-expand the first two levels
  const hasChildren = node.children.length > 0;
  return (
    <div className={isRoot ? "" : "ml-4 border-l border-black/10 pl-3"}>
      <div className="flex items-center gap-2 py-0.5">
        {hasChildren ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid h-4 w-4 shrink-0 place-items-center rounded bg-black/5 text-[10px] text-slate-500"
          >
            {open ? "−" : "+"}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0 text-center text-slate-400">•</span>
        )}
        <span className={`font-medium ${isRoot ? "text-[#111111]" : "text-slate-200"}`}>
          {node.username}
        </span>
        {hasChildren && (
          <span className="chip bg-black/5 text-[10px] text-slate-500">
            {node.children.length}
          </span>
        )}
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((c) => (
            <TreeBranch key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
