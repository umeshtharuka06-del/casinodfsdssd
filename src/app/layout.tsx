import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UserProvider } from "@/lib/user-context";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AppFrame } from "@/components/AppFrame";

// Clean, readable typography:
//  • Inter — highly readable UI face for body copy and most headings.
//  • Oxanium — techy display face reserved for the brand mark and countdown digits.
//
// These are SELF-HOSTED (next/font/local) rather than fetched from Google
// (next/font/google). next/font/google downloads the font files from
// fonts.gstatic.com *during `next build`*; a Docker/VPS build that can reach the
// npm registry but not Google (firewall, proxy, or Google rate-limiting the
// datacenter IP) then fails the build with `Failed to compile ... layout.tsx`.
// The latin .woff2 files (exact weights below) are vendored in ./fonts, so the
// build is fully offline and deterministic.
const display = localFont({
  src: [
    { path: "./fonts/Oxanium-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Oxanium-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Oxanium-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: [
    { path: "./fonts/Inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

const SITE = "https://mega99.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Mega 99 — Colour Prediction & Crash",
    template: "%s · Mega 99",
  },
  description:
    "Mega 99 — a premium, mobile-first colour prediction gaming platform. Play Parity, Sapre, Bcone, Emerd and Crash with instant rounds and fast payouts.",
  applicationName: "Mega 99",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Mega 99",
    title: "Mega 99 — Colour Prediction & Crash",
    description:
      "Play Parity, Sapre, Bcone, Emerd and Crash on Mega 99 — premium colour prediction gaming.",
    url: SITE,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Mega 99" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mega 99 — Colour Prediction & Crash",
    description: "Premium colour prediction gaming — Parity, Sapre, Bcone, Emerd & Crash.",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#4E54C8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Display + numeric fonts (Outfit, Space Grotesk). Loaded at runtime via
            the Google Fonts CDN so the offline/Docker build never depends on a
            build-time font fetch. Inter/Oxanium remain self-hosted fallbacks. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <UserProvider>
          <TopBar />
          <AppFrame>{children}</AppFrame>
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
