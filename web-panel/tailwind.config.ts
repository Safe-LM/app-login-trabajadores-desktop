import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mapeo de las CSS variables del design system
        bg: {
          black:    "var(--bg-black)",
          card:     "var(--bg-card)",
          elevated: "var(--bg-elevated)",
          hover:    "var(--bg-hover)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong:  "var(--border-strong)",
          hover:   "var(--border-hover)",
        },
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
          faint:     "var(--text-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover:   "var(--accent-hover)",
          glow:    "var(--accent-glow)",
          soft:    "var(--accent-soft)",
        },
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
