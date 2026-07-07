import Image from "next/image";

/**
 * Mega 99 header/auth logo. Renders the single canonical asset at
 * `public/images/mega99-logo.png` (absolute public path). Height-based sizing
 * with `w-auto` + `object-contain` preserves the aspect ratio (never stretched);
 * pass `className` to override the height (defaults to the header size).
 * Image only — no text.
 */
export function Wordmark({ className = "h-[42px]" }: { className?: string }) {
  return (
    <Image
      src="/images/mega99-logo.png"
      alt="Mega99"
      width={220}
      height={60}
      priority
      className={`w-auto object-contain ${className}`}
    />
  );
}
