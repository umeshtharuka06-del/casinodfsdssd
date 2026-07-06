import Image from "next/image";

/**
 * Mega 99 gold/red wordmark logo used in the app header. Renders the supplied
 * artwork at `public/brand/mega99-wordmark.png`, sized by height with width:auto
 * so its aspect ratio is preserved (never stretched or cropped). High-resolution
 * source is scaled down by the browser for crisp rendering on all displays.
 */
export function Wordmark({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/mega99-wordmark.png"
      alt="Mega 99"
      width={512}
      height={512}
      priority={priority}
      sizes="200px"
      className={`w-auto select-none object-contain ${className}`}
    />
  );
}
