// Compact VIP tier badge. Level 0 = not a VIP (renders nothing unless `showNone`).
// Colours escalate with tier to read as a premium status chip. Design language
// matches the existing `chip` styling.

const TIER_CLS: Record<number, string> = {
  1: "bg-royal-blue/15 text-royal-blue-bright",
  2: "bg-game-violet/15 text-game-violet",
  3: "bg-game-green/15 text-game-green",
  4: "bg-game-gold/20 text-game-gold",
  5: "bg-game-gold/25 text-game-gold ring-1 ring-game-gold/40",
};

export function VipBadge({
  level,
  showNone = false,
  className = "",
}: {
  level: number;
  showNone?: boolean;
  className?: string;
}) {
  if (level <= 0) {
    if (!showNone) return null;
    return <span className={`chip bg-black/5 text-slate-400 ${className}`}>No VIP</span>;
  }
  return (
    <span className={`chip font-bold ${TIER_CLS[level] ?? TIER_CLS[5]} ${className}`}>
      ★ VIP{level}
    </span>
  );
}
