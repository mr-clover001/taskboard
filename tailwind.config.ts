import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f172a",
        surface: "#1e293b",
        border: "#334155",
        muted: "#94a3b8",
        accent: "#6366f1",
      },
    },
  },
  plugins: [],
} satisfies Config;
