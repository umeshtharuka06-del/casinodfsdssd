import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mega 99 — Colour Prediction",
    short_name: "Mega 99",
    description:
      "Premium colour prediction gaming — Parity, Sapre, Bcone, Emerd & Crash.",
    start_url: "/",
    display: "standalone",
    background_color: "#BE3F51",
    theme_color: "#2D3987",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
