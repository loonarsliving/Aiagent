import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b0f14",
        panel: "#121822",
      },
    },
  },
  plugins: [],
} satisfies Config;
