"use client";

import Link from "next/link";
import { useEffect } from "react";

type IconComp = (p: { className?: string }) => React.ReactNode;

export interface NavItem {
  key: string;
  label: string;
  icon: IconComp;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin navigation. Desktop: a sticky, scrollable left sidebar. Mobile: an
// off-canvas drawer toggled by the hamburger, with a dimmed backdrop. Uses the
// existing palette (royal-blue active state, white surface) — navigation only,
// no content redesign.
// ─────────────────────────────────────────────────────────────────────────────
export function AdminSidebar({
  groups,
  active,
  onSelect,
  open,
  onClose,
}: {
  groups: NavGroup[];
  active: string;
  onSelect: (key: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  // Lock body scroll while the mobile drawer is open; close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-black/10 bg-white shadow-2xl transition-transform duration-300 ease-out md:sticky md:top-4 md:z-auto md:h-[calc(100vh-2rem)] md:w-60 md:max-w-none md:shrink-0 md:translate-x-0 md:rounded-2xl md:border md:shadow-sm ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin navigation"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3.5">
          <div>
            <div className="text-sm font-black text-[#111111]">Admin Console</div>
            <div className="text-[11px] text-slate-400">Mega 99</div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-black/5 md:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className="no-scrollbar flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((g) => (
            <div key={g.label} className="mb-4 last:mb-0">
              <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const isActive = active === it.key;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.key}
                      onClick={() => onSelect(it.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                        isActive
                          ? "bg-royal-blue text-white shadow-sm"
                          : "text-slate-500 hover:bg-black/5 hover:text-[#111111]"
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <span className="truncate">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-black/10 p-2.5">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-black/5 hover:text-[#111111]"
          >
            <span className="text-base">←</span> Back to app
          </Link>
        </div>
      </aside>
    </>
  );
}
