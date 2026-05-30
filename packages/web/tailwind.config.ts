import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#06b6d4",
          muted: "#0e7490"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
