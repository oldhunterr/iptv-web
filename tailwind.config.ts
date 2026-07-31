import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        app: "var(--bg-app)",
        surface: "var(--bg-surface)",
        "surface-hover": "var(--bg-surface-hover)",
        glass: "var(--bg-glass)",
        "border-subtle": "var(--border-subtle)",
        "theme-primary": "var(--text-primary)",
        "theme-muted": "var(--text-muted)",
        "accent-primary": "var(--accent-primary)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",
        "accent-glow": "var(--accent-glow)",
      },
    },
  },
  plugins: [],
};

export default config;
