import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface scale — light, neutral
        // 900 = page bg, 800 = card (white), 700 = inset / hover, 600 = border, 500 = soft border
        surface: {
          900: "#F7F8FA",
          800: "#FFFFFF",
          700: "#F1F5F9",
          600: "#E2E8F0",
          500: "#CBD5E1",
        },
        // Primary accent — blue
        brand: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        // Secondary accent — cyan (used for score highlights, hover, small accents)
        accent: {
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
        // Score tiers
        score: {
          high: "#16A34A",
          mid: "#F59E0B",
          low: "#EF4444",
        },
        // Override slate so existing text-slate-* classes work in light mode.
        slate: {
          100: "#0F172A",
          200: "#0F172A",
          300: "#334155",
          400: "#64748B",
          500: "#94A3B8",
          600: "#64748B",
          700: "#334155",
          800: "#0F172A",
          900: "#0F172A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04)",
        lift: "0 8px 24px rgba(37, 99, 235, 0.08)",
        cta:  "0 1px 2px rgba(37, 99, 235, 0.15), 0 6px 16px rgba(37, 99, 235, 0.20)",
      },
    },
  },
  plugins: [],
};

export default config;
