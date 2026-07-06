"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDE_ON = ["/login", "/register", "/admin"];

// Home · WinGo · Crash · Promotion · Mine — flat full-width bar (777 style).
const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/game", label: "WinGo", icon: DiceIcon },
  { href: "/games/crash", label: "Crash", icon: RocketIcon },
  { href: "/referral", label: "Promotion", icon: GiftIcon },
  { href: "/mine", label: "Mine", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#2D3987] shadow-[0_-1px_2px_rgba(17,17,17,0.1)]">
      <div className="content-col">
        <div className="flex items-stretch justify-between gap-1 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
          {TABS.map((t) => {
            const active = isActive(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition active:scale-95 ${
                  active ? "bg-white/20" : ""
                }`}
              >
                <Icon
                  className={`h-6 w-6 transition ${
                    active ? "text-white" : "text-white/60"
                  }`}
                />
                <span
                  className={`text-[11px] transition ${
                    active ? "font-bold text-white" : "font-medium text-white/60"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ── Inline icons (no extra deps) ── */
type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function DiceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function RocketIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2" />
      <path d="M12.5 4.5C16 2 21 3 21 3s1 5-1.5 8.5L14 17l-3-3 1.5-9.5Z" />
      <circle cx="15" cy="9" r="1.5" />
    </svg>
  );
}
function GiftIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8s-4 0-5-2c-.7-1.4.5-3 2-3 2.5 0 3 5 3 5Zm0 0s4 0 5-2c.7-1.4-.5-3-2-3-2.5 0-3 5-3 5Z" />
    </svg>
  );
}
function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
