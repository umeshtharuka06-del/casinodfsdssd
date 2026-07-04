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
          blue: "#798DFE",
          "blue-bright": "#2D3987", // dark blue — readable links/icons/heads
          red: "#D81E2C",
          "red-bright": "#B31220",
          yellow: "#4C6C06",
          "yellow-bright": "#3A5305",
        },
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
          DEFAULT: "#BE3F51",
          soft: "#C9556A",
          deep: "#EEF1FF",
        },
        // Legacy surface ramp — remapped to the light surfaces.
        ink: {
          950: "#E6E9FF",
          900: "#BE3F51",
          800: "#EEF1FF",
          700: "#FFFFFF",
          600: "#F6F7FF",
          500: "#E6E9FF",
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
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-head)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Very light shadows only — flat layered panels, no floating effects.
        glow: "0 4px 12px rgba(0,0,0,0.08)",
        "glow-red": "0 4px 12px rgba(0,0,0,0.08)",
        "glow-yellow": "0 4px 12px rgba(0,0,0,0.08)",
        "glow-green": "0 4px 12px rgba(0,0,0,0.08)",
        card: "0 4px 12px rgba(0,0,0,0.08)",
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
