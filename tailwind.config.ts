import type { Config } from "tailwindcss";

// brand, accent e slate leggono le variabili CSS generate dal tema (src/lib/theme.ts):
// i colori si cambiano da Admin → Aspetto senza ricompilare. "slate" è la scala dei neutri.
const fromVar = (name: string, shades: number[]) =>
  Object.fromEntries(shades.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: fromVar("brand", SHADES),
        accent: fromVar("accent", SHADES),
        slate: fromVar("slate", SHADES),
      },
    },
  },
  plugins: [],
} satisfies Config;
