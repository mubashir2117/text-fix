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
        paper: "#EFF1EA",
        "paper-dim": "#E6E8DF",
        surface: "#FFFFFF",
        ink: "#1B1F1C",
        "ink-soft": "#4B5148",
        "ink-faint": "#8A8F82",
        line: "#DAD8CC",
        pen: {
          DEFAULT: "#B23A28",
          soft: "#F1DAD3",
        },
        approve: {
          DEFAULT: "#2E6E49",
          soft: "#DCE9DD",
        },
        flag: {
          DEFAULT: "#A8730C",
          soft: "#F0E3C6",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        desk: "0 1px 2px rgba(27, 31, 28, 0.06), 0 8px 24px -12px rgba(27, 31, 28, 0.18)",
      },
      borderRadius: {
        card: "10px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "write-line": {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
