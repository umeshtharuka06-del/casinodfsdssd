"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { CoinIcon } from "@/components/CoinIcon";
import { VipBadge } from "@/components/VipBadge";
import { coins } from "@/lib/fmt";
import { UserDetailsDrawer } from "@/components/admin/UserDetailsDrawer";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  isBanned: boolean;
  vipLevel: number;
  vipOverride: number | null;
  qualifiedReferrals: number;
  totalDeposits: number;
  totalDepositsFmt: string;
  totalWithdrawals: number;
  totalWithdrawalsFmt: string;
  totalWinnings: number;
  totalWinningsFmt: string;
  totalLoss: number;
  totalLossFmt: string;
  netGain: number;
  netGainFmt: string;
  balance: number;
  balanceFmt: string;
  lastLogin: string | null;
  referralCode?: string;
  referredBy?: string | null;
  createdAt: string;
}

type SortKey =
  | "username" | "balance" | "createdAt" | "vipLevel" | "qualifiedReferrals"
  | "totalDeposits" | "totalWithdrawals" | "netGain" | "lastLogin";
const PAGE_SIZE = 10;

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [vip, setVip] = useState("-1");
  const [busy, setBusy] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const query = useCallback(
    () => `q=${encodeURIComponent(q)}&status=${status}&vip=${vip}`,
    [q, status, vip]
  );

  const load = useCallback(async () => {
    const res = await api<AdminUser[]>(`/api/admin/users?${query()}`);
    if (res.ok) setUsers(res.data || []);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const sorted = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "username": cmp = a.username.localeCompare(b.username); break;
        case "balance": cmp = a.balance - b.balance; break;
        case "vipLevel": cmp = a.vipLevel - b.vipLevel; break;
        case "qualifiedReferrals": cmp = a.qualifiedReferrals - b.qualifiedReferrals; break;
        case "totalDeposits": cmp = a.totalDeposits - b.totalDeposits; break;
        case "totalWithdrawals": cmp = a.totalWithdrawals - b.totalWithdrawals; break;
        case "netGain": cmp = a.netGain - b.netGain; break;
        case "lastLogin": cmp = (a.lastLogin ? +new Date(a.lastLogin) : 0) - (b.lastLogin ? +new Date(b.lastLogin) : 0); break;
        default: cmp = +new Date(a.createdAt) - +new Date(b.createdAt);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [users, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [q, status, vip, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "username" ? "asc" : "desc");
    }
  }

  async function act(userId: string, action: string, amount?: number) {
    setBusy(userId + action);
    await api("/api/admin/users", { json: { userId, action, amount } });
    setBusy("");
    load();
  }

  function adjust(u: AdminUser, sign: 1 | -1) {
    const raw = prompt(`${sign > 0 ? "Credit" : "Debit"} how many coins for ${u.username}?`);
    const amount = Number(raw);
    if (!amount || amount <= 0) return;
    act(u.id, sign > 0 ? "credit" : "debit", amount);
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const netCls = (n: number) => (n > 0 ? "text-game-green" : n < 0 ? "text-game-red-bright" : "text-slate-400");

  return (
    <div className="card p-4 md:p-5">
      {/* Search + filters + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 md:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
          <input
            className="input !pl-9"
            placeholder="Search username, email, referral code / link, wallet address…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="admin">Admins</option>
        </select>
        <select className="input !w-auto" value={vip} onChange={(e) => setVip(e.target.value)}>
          <option value="-1">Any VIP</option>
          <option value="1">VIP1+</option>
          <option value="2">VIP2+</option>
          <option value="3">VIP3+</option>
          <option value="4">VIP4+</option>
          <option value="5">VIP5</option>
        </select>
        <a href={`/api/admin/users?${query()}&format=csv`} className="btn-ghost !py-2 text-xs">
          Export CSV
        </a>
        <span className="text-xs text-slate-500">{sorted.length} users</span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-black/10">
              <Th onClick={() => toggleSort("username")}>User{arrow("username")}</Th>
              <Th onClick={() => toggleSort("vipLevel")}>VIP{arrow("vipLevel")}</Th>
              <Th onClick={() => toggleSort("qualifiedReferrals")}>Q.Refs{arrow("qualifiedReferrals")}</Th>
              <Th onClick={() => toggleSort("totalDeposits")}>Deposits{arrow("totalDeposits")}</Th>
              <Th onClick={() => toggleSort("totalWithdrawals")}>Withdrawals{arrow("totalWithdrawals")}</Th>
              <Th>Winnings</Th>
              <Th>Loss</Th>
              <Th onClick={() => toggleSort("netGain")}>Net{arrow("netGain")}</Th>
              <Th onClick={() => toggleSort("balance")}>Balance{arrow("balance")}</Th>
              <Th onClick={() => toggleSort("lastLogin")}>Last login{arrow("lastLogin")}</Th>
              <Th onClick={() => toggleSort("createdAt")}>Joined{arrow("createdAt")}</Th>
              <th className="pr-3">Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {pageRows.map((u) => (
              <tr key={u.id}>
                <td className="py-3 pr-3">
                  <button onClick={() => setDetailId(u.id)} className="flex items-center gap-2 text-left" title="View full details">
                    <Avatar name={u.username} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100 hover:underline">{u.username}</div>
                      <div className="truncate text-xs text-slate-500">{u.email}</div>
                    </div>
                  </button>
                </td>
                <td className="pr-3"><VipBadge level={u.vipLevel} showNone /></td>
                <td className="pr-3 font-semibold text-game-violet">{u.qualifiedReferrals}</td>
                <td className="whitespace-nowrap pr-3 text-game-green"><CoinIcon /> {coins(u.totalDepositsFmt)}</td>
                <td className="whitespace-nowrap pr-3 text-royal-blue-bright"><CoinIcon /> {coins(u.totalWithdrawalsFmt)}</td>
                <td className="whitespace-nowrap pr-3 text-slate-300"><CoinIcon /> {coins(u.totalWinningsFmt)}</td>
                <td className="whitespace-nowrap pr-3 text-slate-300"><CoinIcon /> {coins(u.totalLossFmt)}</td>
                <td className={`whitespace-nowrap pr-3 font-semibold ${netCls(u.netGain)}`}><CoinIcon /> {coins(u.netGainFmt)}</td>
                <td className="whitespace-nowrap pr-3 font-semibold text-game-gold"><CoinIcon /> {coins(u.balanceFmt)}</td>
                <td className="whitespace-nowrap pr-3 text-xs text-slate-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"}</td>
                <td className="whitespace-nowrap pr-3 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="pr-3"><Badges u={u} /></td>
                <td><Actions u={u} busy={busy} act={act} adjust={adjust} /></td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={13} className="py-8 text-center text-slate-400">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {pageRows.map((u) => (
          <div key={u.id} className="rounded-xl border border-black/10 bg-[#FFF6CC] p-3">
            <div className="flex items-center gap-3">
              <Avatar name={u.username} />
              <button onClick={() => setDetailId(u.id)} className="min-w-0 flex-1 text-left" title="View full details">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-slate-100 hover:underline">{u.username}</span>
                  <VipBadge level={u.vipLevel} />
                </div>
                <div className="truncate text-xs text-slate-500">{u.email}</div>
              </button>
              <div className="whitespace-nowrap text-sm font-semibold text-game-gold"><CoinIcon /> {coins(u.balanceFmt)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <Mini label="Q.Refs" value={String(u.qualifiedReferrals)} />
              <Mini label="Deposits" value={coins(u.totalDepositsFmt)} coin />
              <Mini label="Withdrawals" value={coins(u.totalWithdrawalsFmt)} coin />
              <Mini label="Net" value={coins(u.netGainFmt)} coin cls={netCls(u.netGain)} />
              <Mini label="Last login" value={u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "—"} />
              <Mini label="Joined" value={new Date(u.createdAt).toLocaleDateString()} />
            </div>
            <div className="mt-2"><Badges u={u} /></div>
            <div className="mt-3"><Actions u={u} busy={busy} act={act} adjust={adjust} /></div>
          </div>
        ))}
        {pageRows.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No users found.</div>}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost !py-2 text-xs">← Prev</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost !py-2 text-xs">Next →</button>
        </div>
      </div>

      {detailId && <UserDetailsDrawer userId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th className={`pr-3 ${onClick ? "cursor-pointer select-none" : ""} ${onClick ? "" : ""} py-2`} onClick={onClick}>
      {children}
    </th>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-royal-blue text-xs font-black text-white">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Mini({ label, value, coin, cls }: { label: string; value: string; coin?: boolean; cls?: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className={`font-semibold ${cls ?? "text-slate-200"}`}>
        {coin && <CoinIcon className="text-game-gold" />} {value}
      </span>
    </div>
  );
}

function Badges({ u }: { u: AdminUser }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`chip ${u.isAdmin ? "bg-game-gold/20 text-game-gold" : "bg-black/5 text-slate-400"}`}>
        {u.isAdmin ? "Admin" : "Player"}
      </span>
      <span className={`chip ${u.isBanned ? "bg-game-red/20 text-game-red-bright" : "bg-game-green/15 text-game-green"}`}>
        {u.isBanned ? "Banned" : "Active"}
      </span>
    </div>
  );
}

function Actions({
  u,
  busy,
  act,
  adjust,
}: {
  u: AdminUser;
  busy: string;
  act: (userId: string, action: string, amount?: number) => void;
  adjust: (u: AdminUser, sign: 1 | -1) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 md:justify-end">
      <button onClick={() => adjust(u, 1)} className="chip bg-game-green/15 text-game-green active:bg-game-green/25">+ coins</button>
      <button onClick={() => adjust(u, -1)} className="chip bg-black/5 text-slate-300 active:bg-black/[0.07]">− coins</button>
      <button onClick={() => act(u.id, u.isBanned ? "unban" : "ban")} disabled={!!busy} className="chip bg-game-red/15 text-game-red-bright active:bg-game-red/25">
        {u.isBanned ? "unban" : "ban"}
      </button>
      <button onClick={() => act(u.id, u.isAdmin ? "removeAdmin" : "makeAdmin")} disabled={!!busy} className="chip bg-royal-blue/15 text-royal-blue-bright active:bg-royal-blue/25">
        {u.isAdmin ? "demote" : "promote"}
      </button>
    </div>
  );
}
