import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-able colors
        background: "rgb(var(--color-background) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--color-card) / <alpha-value>)",
          foreground: "rgb(var(--color-card-foreground) / <alpha-value>)",
          border: "rgb(var(--color-card-border) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-muted) / <alpha-value>)",
          foreground: "rgb(var(--color-muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          foreground: "rgb(var(--color-accent-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--color-border) / <alpha-value>)",
        input: "rgb(var(--color-input) / <alpha-value>)",
        
        // Brand & Palette
        primary: "#243665",
        cyan: "rgb(var(--color-cyan) / <alpha-value>)",
        magenta: "rgb(var(--color-magenta) / <alpha-value>)",
        teal: "#053b50",
        customGray: {
          light: "#a62830",
          medium: "#838987",
        },
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        field: "rgb(var(--color-field) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        brand: "rgb(var(--color-brand) / <alpha-value>)",
        leaf: "rgb(var(--color-leaf) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        aqua: "rgb(var(--color-aqua) / <alpha-value>)",
        lilac: "rgb(var(--color-lilac) / <alpha-value>)",
        butter: "#ffe08a",
        coral: "#ff8d7a",
        night: "rgb(var(--color-night) / <alpha-value>)"
      },
      boxShadow: {
        card: "0 18px 50px rgba(67, 56, 120, 0.12)",
        glow: "0 14px 34px rgba(239, 93, 117, 0.28)",
        soft: "0 10px 28px rgba(41, 51, 71, 0.10)"
      },
      keyframes: {
        "soft-pop": {
          "0%": { transform: "scale(.98)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        "mic-pulse": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(105, 205, 231, .32)" },
          "50%": { transform: "scale(1.06)", boxShadow: "0 0 0 18px rgba(105, 205, 231, 0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        },
        wobble: {
          "0%, 100%": { transform: "rotate(15deg)" },
          "50%": { transform: "rotate(-10deg)" }
        }
      },
      animation: {
        "soft-pop": "soft-pop .22s ease-out",
        "mic-pulse": "mic-pulse 1.7s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        wobble: "wobble 1s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
