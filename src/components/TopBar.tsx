"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/user-context";
import { CoinIcon } from "./CoinIcon";
import { Wordmark } from "./Wordmark";
import { coins } from "@/lib/fmt";

const HIDE_ON = ["/login", "/register", "/admin"];

export function TopBar() {
  const { me, loading } = useUser();
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-40 bg-[#2D3987] shadow-[0_1px_2px_rgba(17,17,17,0.1)]">
      <div className="content-col">
        {/* Fixed row height keeps the header height constant even as the logo
            grows; items-center vertically centres the logo and balance widget. */}
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center" aria-label="Mega 99 home">
            {/* Premium gold/red wordmark artwork (with text fallback on load
                error). h-[42px] is ~17% larger than the previous h-9 (36px);
                width auto preserves aspect ratio (no stretch). */}
            <Wordmark priority className="h-[42px]" />
          </Link>

          {loading ? (
            <div className="skeleton h-9 w-28" />
          ) : me ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
                <CoinIcon size={17} />
                <span className="text-sm font-bold tabular-nums text-[#111111]">
                  {coins(me.balanceFmt)}
                </span>
              </div>
              <Link
                href="/deposit"
                className="grid h-8 w-8 place-items-center rounded-lg bg-[#4C6C06] text-white transition hover:brightness-95 active:scale-95"
                aria-label="Deposit"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ height: 18, width: 18 }}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-white/40 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-royal-blue-bright transition hover:bg-[#ffe08a] active:scale-95"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
