import Image from "next/image";

/**
 * Mega 99 brand mark — renders the single canonical logo asset at
 * `public/images/mega99-logo.png` (served at `/images/mega99-logo.png`). One
 * file is used everywhere; the logo is never recreated or restyled, only sized,
 * preserving its aspect ratio (objectFit contain — no stretch/crop).
 */
export function BrandLogo({
  size = 36,
  priority = false,
  className = "",
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/images/mega99-logo.png"
      alt="Mega 99"
      width={size}
      height={size}
      priority={priority}
      className={`select-none ${className}`}
      style={{ height: size, width: size, objectFit: "contain" }}
    />
  );
}
