"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "@/components/CoinIcon";
import { ReferralIcon } from "@/components/icons";
import { coins } from "@/lib/fmt";

interface Reward {
  id: string;
  username: string;
  amountFmt: string;
  amountUsdt: number;
  status: "PENDING" | "CLAIMABLE" | "CLAIMED";
  createdAt: string;
  unlockAt: string;
  claimedAt: string | null;
}
interface Summary {
  code: string;
  count: number;
  depositedCount: number;
  pendingFmt: string;
  claimable: number;
  claimableFmt: string;
  claimedFmt: string;
  balanceFmt: string;
  rewards: Reward[];
  recent: Array<{ username: string; createdAt: string; deposited: boolean }>;
}

const STATUS_STYLE: Record<Reward["status"], { label: string; cls: string }> = {
  PENDING: { label: "Locked", cls: "bg-accent-orange/15 text-accent-orange" },
  CLAIMABLE: { label: "Claimable", cls: "bg-game-green/15 text-game-green" },
  CLAIMED: { label: "Claimed", cls: "bg-black/5 text-slate-400" },
};

export default function ReferralPage() {
  const { me, loading, refresh, setBalanceFmt } = useUser();
  const router = useRouter();
  const [sum, setSum] = useState<Summary | null>(null);
  const [tab, setTab] = useState<"rewards" | "invited">("rewards");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !me) router.replace("/login?next=/referral");
  }, [loading, me, router]);

  const load = useCallback(async () => {
    const r = await api<Summary>("/api/me/referrals");
    if (r.ok && r.data) setSum(r.data);
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [me, load]);

  const link =
    typeof window !== "undefined" && me
      ? `${window.location.origin}/register?ref=${me.id}`
      : "";

  function copy(kind: "code" | "link", text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  async function claim() {
    setMsg(null);
    setBusy(true);
    const r = await api<{ creditedFmt: string; balanceFmt: string; balance: number }>(
      "/api/me/referrals/claim",
      { method: "POST" }
    );
    setBusy(false);
    if (!r.ok) return setMsg({ text: r.error || "Nothing to claim.", ok: false });
    setBalanceFmt(r.data!.balanceFmt, r.data!.balance);
    setMsg({ text: `+${r.data!.creditedFmt} coins moved to your wallet.`, ok: true });
    refresh();
    load();
  }

  if (!me || !sum) {
    return (
      <div className="space-y-3 py-2">
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <h1 className="flex items-center gap-2 px-1 text-lg font-bold text-white">
        <ReferralIcon className="h-5 w-5 text-royal-blue-bright" /> Promotion
      </h1>

      {/* Rewards summary + claim */}
      <div className="card overflow-hidden">
        <div className="panel-head rounded-t-2xl">
          <span>Referral rewards</span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
            <ReferralIcon className="h-4 w-4" />
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="well px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-[#777777]">Referral balance</div>
              <div className="mt-1 text-base font-bold tabular-nums text-[#111111]">
                {coins(sum.balanceFmt)}
              </div>
            </div>
            <div className="well px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-[#777777]">Pending</div>
              <div className="mt-1 text-base font-bold tabular-nums text-accent-orange">
                {coins(sum.pendingFmt)}
              </div>
            </div>
            <div className="well px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-[#777777]">Claimable</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-base font-bold tabular-nums text-game-green">
                <CoinIcon size={15} /> {coins(sum.claimableFmt)}
              </div>
            </div>
          </div>

          <button
            onClick={claim}
            disabled={busy || sum.claimable === 0}
            className="btn-green mt-4 w-full !py-3.5 text-base"
          >
            {busy ? "Claiming…" : "Claim to wallet"}
          </button>
          {msg && (
            <div
              className={`mt-2 rounded-xl px-3 py-2 text-sm font-medium ${
                msg.ok ? "bg-game-green/15 text-game-green" : "bg-game-red/15 text-game-red"
              }`}
            >
              {msg.text}
            </div>
          )}
          <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#777777]">
            Earn 4 USDT in coins each time a friend you invited makes their first
            deposit. Rewards stay locked for 7 days, then you can claim them into
            your wallet. Claimed so far: {coins(sum.claimedFmt)} coins.
          </p>
        </div>
      </div>

      {/* Invite stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <div className="text-xs font-medium text-[#666666]">Invited users</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-royal-blue-bright">
            {sum.count}
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-xs font-medium text-[#666666]">Successful deposits</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-game-green">
            {sum.depositedCount}
          </div>
        </div>
      </div>

      {/* Code + link */}
      <div className="card overflow-hidden">
        <div className="panel-head rounded-t-2xl">Share &amp; earn</div>
        <div className="space-y-3 p-4">
          <div>
            <div className="mb-1 text-xs font-medium text-[#666666]">My promotion code</div>
            <div className="flex gap-2">
              <code className="well flex-1 truncate px-3 py-2.5 font-mono text-xs font-semibold text-[#111111]">
                {sum.code}
              </code>
              <button
                onClick={() => copy("code", sum.code)}
                className="btn-blue !px-4 !py-2 text-xs"
              >
                {copied === "code" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[#666666]">My referral link</div>
            <div className="flex gap-2">
              <code className="well flex-1 truncate px-3 py-2.5 font-mono text-xs font-semibold text-[#111111]">
                {link}
              </code>
              <button
                onClick={() => copy("link", link)}
                className="btn-blue !px-4 !py-2 text-xs"
              >
                {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card p-4">
        <div className="pill-tabs mb-3">
          <button
            onClick={() => setTab("rewards")}
            className={`pill-tab ${tab === "rewards" ? "pill-tab-active" : ""}`}
          >
            Rewards
          </button>
          <button
            onClick={() => setTab("invited")}
            className={`pill-tab ${tab === "invited" ? "pill-tab-active" : ""}`}
          >
            Invited
          </button>
        </div>

        {tab === "rewards" ? (
          sum.rewards.length === 0 ? (
            <Empty text="No rewards yet — share your link to start earning." />
          ) : (
            <div className="divide-y divide-black/5">
              {sum.rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#111111]">
                      {r.username}
                    </div>
                    <div className="text-[11px] font-medium text-[#777777]">
                      {r.status === "PENDING"
                        ? `Unlocks ${new Date(r.unlockAt).toLocaleDateString()}`
                        : r.status === "CLAIMED" && r.claimedAt
                        ? `Claimed ${new Date(r.claimedAt).toLocaleDateString()}`
                        : `Earned ${new Date(r.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums text-game-green">
                      +<CoinIcon /> {coins(r.amountFmt)}
                    </div>
                    <span className={`chip mt-0.5 ${STATUS_STYLE[r.status].cls}`}>
                      {STATUS_STYLE[r.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : sum.recent.length === 0 ? (
          <Empty text="No one has joined from your link yet." />
        ) : (
          <div className="divide-y divide-black/5">
            {sum.recent.map((u, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-semibold text-[#111111]">{u.username}</div>
                  <div className="text-[11px] font-medium text-[#777777]">
                    Joined {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`chip ${
                    u.deposited
                      ? "bg-game-green/15 text-game-green"
                      : "bg-black/5 text-slate-400"
                  }`}
                >
                  {u.deposited ? "Deposited" : "Registered"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm font-medium text-[#777777]">{text}</div>;
}
