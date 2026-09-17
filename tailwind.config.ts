import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5F1",
        "paper-dim": "#EFECE5",
        surface: "#FFFFFF",
        ink: "#1C1B19",
        "ink-soft": "#52504B",
        "ink-faint": "#8A8780",
        line: "#E6E2DA",
        pen: {
          DEFAULT: "#B3422F",
          soft: "#F7E4DE",
        },
        approve: {
          DEFAULT: "#2E6B4E",
          soft: "#E2EEE6",
        },
        flag: {
          DEFAULT: "#9A6B0B",
          soft: "#F4E9D2",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        desk: "0 1px 2px rgba(28, 27, 25, 0.05), 0 12px 32px -16px rgba(28, 27, 25, 0.16)",
        soft: "0 1px 2px rgba(28, 27, 25, 0.04), 0 4px 16px -8px rgba(28, 27, 25, 0.12)",
      },
      borderRadius: {
        card: "12px",
        panel: "20px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        "scale-in": "scale-in 0.35s ease-out both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
        scan: "scan 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;