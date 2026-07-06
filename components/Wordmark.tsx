import Image from "next/image";

/**
 * Mega 99 header logo. Renders the single canonical asset at
 * `public/images/mega99-logo.png` (absolute public path `/images/mega99-logo.png`).
 * Height-based sizing with `w-auto` + `object-contain` preserves the aspect
 * ratio (never stretched); vertical centering is handled by the header's flex
 * `items-center` row. Image only — no text fallback.
 */
export function Wordmark() {
  return (
    <Image
      src="/images/mega99-logo.png"
      alt="Mega99"
      width={220}
      height={60}
      priority
      className="w-auto h-[42px] object-contain"
    />
  );
}
