"use client";

import { useState } from "react";

/**
 * Mega 99 gold/red wordmark logo for the app header.
 *
 * Renders the artwork at `public/brand/mega99-wordmark.png` (served from the
 * public folder at the absolute path `/brand/mega99-wordmark.png`). Sized by
 * height with width:auto so the aspect ratio is always preserved (never
 * stretched or cropped).
 *
 * Graceful fallback: if the image fails to load (missing file, network error),
 * we render the previous MEGA 99 text lockup instead of a broken-image icon —
 * so the header always shows a clean brand mark. A plain <img> is used (not
 * next/image) precisely so this onError fallback is reliable and no optimizer
 * placeholder or broken icon can appear.
 */
export function Wordmark({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="font-display text-lg font-extrabold leading-none tracking-tight text-white">
        MEGA <span className="text-[#f6b738]">99</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mega99-wordmark.png"
      alt="Mega 99"
      onError={() => setFailed(true)}
      loading={priority ? "eager" : "lazy"}
      className={`block w-auto select-none object-contain ${className}`}
    />
  );
}
