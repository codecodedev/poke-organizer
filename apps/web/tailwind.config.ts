import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        field: "#f7f5ff",
        line: "#e4dff2",
        brand: "#ef5d75",
        leaf: "#55c7a9",
        amber: "#f4b35f",
        aqua: "#69cde7",
        lilac: "#a891f5",
        butter: "#ffe08a",
        coral: "#ff8d7a",
        night: "#293347"
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
        }
      },
      animation: {
        "soft-pop": "soft-pop .22s ease-out",
        "mic-pulse": "mic-pulse 1.7s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
