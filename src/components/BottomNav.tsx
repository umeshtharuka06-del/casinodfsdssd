"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  Squares2X2Icon,
  RocketLaunchIcon,
  GiftIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

const HIDE_ON = ["/login", "/register", "/admin"];

// Home · WinGo · Crash · Promotion · Mine — gradient nav bar (Heroicons).
const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/game", label: "WinGo", icon: Squares2X2Icon },
  { href: "/games/crash", label: "Crash", icon: RocketLaunchIcon },
  { href: "/referral", label: "Promotion", icon: GiftIcon },
  { href: "/mine", label: "Mine", icon: UserCircleIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 shadow-[0_-4px_16px_rgba(78,84,200,0.22)]"
      style={{ background: "linear-gradient(180deg, #4E54C8 0%, #6C63FF 100%)" }}
    >
      <div className="content-col">
        <div className="flex items-stretch justify-between gap-1 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
          {TABS.map((t) => {
            const active = isActive(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-all duration-200 active:scale-95 ${
                  active ? "bg-white/20" : ""
                }`}
              >
                <Icon
                  className={`h-6 w-6 transition ${active ? "text-white" : "text-white/70"}`}
                />
                <span
                  className={`text-[11px] transition ${
                    active ? "font-bold text-white" : "font-medium text-white/70"
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
