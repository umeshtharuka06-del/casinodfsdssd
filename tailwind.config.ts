import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mega 99 palette — flat betting dashboard (yellow + blue lottery).
        // Blue #798DFE · Dark Blue #2D3987 · Background #FFD966 ·
        // Green #4C6C06 · Red #D81E2C · Purple #8A4DDE · Gold coin #FFD700.
        royal: {
          blue: "#6C63FF", // primary brand blue
          "blue-bright": "#4E54C8", // deep indigo — headers / readable accents
          red: "#D81E2C",
          "red-bright": "#B31220",
          yellow: "#4C6C06",
          "yellow-bright": "#3A5305",
        },
        // Money / UI accents (distinct from the betting green/red/violet).
        money: { green: "#18C29C", orange: "#FFA31A", danger: "#E53935" },
        brand: { blue: "#6C63FF", "blue-2": "#5A52F5", deep: "#4E54C8", light: "#EEF2FF" },
        // Game accents used across the prediction UI.
        game: {
          green: "#4C6C06",
          "green-deep": "#3A5305",
          mint: "#4C6C06",
          red: "#D81E2C",
          "red-deep": "#B31220",
          violet: "#8B5CF6",
          "violet-deep": "#7C3AED",
          // "gold" text slot → primary black (readable money amounts on light).
          gold: "#111111",
          "gold-soft": "#FFE08A",
          "gold-deep": "#D98A14",
        },
        mega: {
          gold: "#F6B738",
          "gold-soft": "#FFE08A",
          black: "#111111",
        },
        accent: {
          orange: "#8B5CF6", // legacy accent slot → real violet
          "orange-deep": "#7C3AED",
        },
        cream: {
          DEFAULT: "#F7F8FC",
          soft: "#FFFFFF",
          deep: "#EEF2FF",
        },
        // Legacy surface ramp — remapped to the light surfaces.
        ink: {
          950: "#EEF2FF",
          900: "#F7F8FC",
          800: "#EEF2FF",
          700: "#FFFFFF",
          600: "#F7F8FC",
          500: "#EEF2FF",
        },
        // The app's text hierarchy rides on slate-* classes; remap them to the
        // dark-on-light scale (200 = strongest … 600 = faintest caption).
        slate: {
          100: "#111111",
          200: "#222222",
          300: "#444444",
          400: "#666666",
          500: "#777777",
          600: "#999999",
          700: "#AAAAAA",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-head)", "Outfit", "var(--font-sans)", "system-ui", "sans-serif"],
        num: ["var(--font-num)", "Space Grotesk", "var(--font-sans)", "monospace"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.125rem", // 18px — the design-system radius
        "3xl": "1.5rem",
      },
      boxShadow: {
        // Soft premium shadows — 0 8px 24px rgba(25,25,25,.08).
        glow: "0 8px 24px rgba(25,25,25,0.08)",
        "glow-red": "0 8px 24px rgba(25,25,25,0.08)",
        "glow-yellow": "0 8px 24px rgba(25,25,25,0.08)",
        "glow-green": "0 8px 24px rgba(25,25,25,0.08)",
        card: "0 8px 24px rgba(25,25,25,0.08)",
        lift: "0 14px 30px rgba(25,25,25,0.12)",
      },
      keyframes: {
        "pulse-glow": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "win-burst": {
          "0%": { transform: "scale(0.4) rotate(-8deg)", opacity: "0" },
          "50%": { transform: "scale(1.15) rotate(3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0)", opacity: "1" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-5px)" },
          "40%,80%": { transform: "translateX(5px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "count-flip": {
          "0%": { transform: "rotateX(90deg)", opacity: "0" },
          "100%": { transform: "rotateX(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "spin-slow": "spin-slow 18s linear infinite",
        "slide-up": "slide-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
        pop: "pop 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "win-burst": "win-burst 0.5s cubic-bezier(0.22,1,0.36,1) both",
        shake: "shake 0.45s ease",
        "count-flip": "count-flip 0.3s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
