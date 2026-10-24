import { z } from "zod";

/*
 * Aspetto del portale. Il tema è un oggetto piatto salvato come JSON nella tabella Setting
 * (chiave "theme") e tradotto in variabili CSS: Tailwind legge brand/accent/slate da lì
 * (tailwind.config.ts), così cambiare un colore non richiede una nuova build.
 * Modulo condiviso: lo usano sia il layout (server) sia l'anteprima dell'editor (client).
 */

export const FONT_KEYS = [
  "fraunces",
  "playfair",
  "lora",
  "dmSerif",
  "dmSans",
  "nunito",
  "outfit",
  "jakarta",
  "manrope",
  "inter",
  "system",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_LABELS: Record<FontKey, string> = {
  fraunces: "Fraunces (serif morbido)",
  playfair: "Playfair Display (serif elegante)",
  lora: "Lora (serif da lettura)",
  dmSerif: "DM Serif Display (serif deciso)",
  dmSans: "DM Sans",
  nunito: "Nunito (arrotondato)",
  outfit: "Outfit (geometrico)",
  jakarta: "Plus Jakarta Sans",
  manrope: "Manrope",
  inter: "Inter",
  system: "Carattere di sistema",
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Solo immagini del portale: esempi in /presets o caricamenti in /media. Niente URL esterni. */
const image = z.union([z.literal(""), z.string().regex(/^\/(presets|media)\/[A-Za-z0-9._-]+$/)]);
const text = (max: number) => z.string().max(max);

export const themeSchema = z.object({
  // identità
  logoUrl: image,
  logoHeight: z.number().int().min(20).max(120),
  showName: z.boolean(),
  // colori
  primary: hex,
  accent: hex,
  neutral: hex,
  pageBg: hex,
  surface: hex,
  heading: hex,
  headerBg: hex,
  headerText: hex,
  footerBg: hex,
  footerText: hex,
  // tipografia
  headingFont: z.enum(FONT_KEYS),
  bodyFont: z.enum(FONT_KEYS),
  baseSize: z.number().int().min(14).max(19),
  headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]),
  // forme
  radius: z.number().int().min(0).max(28),
  buttonShape: z.enum(["square", "rounded", "pill"]),
  shadow: z.enum(["none", "soft", "medium", "strong"]),
  cardBorder: z.boolean(),
  cardAccentBar: z.boolean(),
  // impaginazione
  width: z.enum(["narrow", "normal", "wide"]),
  headerSticky: z.boolean(),
  headerShadow: z.boolean(),
  // banner della home
  heroEnabled: z.boolean(),
  heroImage: image,
  heroHeight: z.enum(["sm", "md", "lg", "xl"]),
  heroAlign: z.enum(["left", "center"]),
  heroFullWidth: z.boolean(),
  heroOverlay: hex,
  heroOverlayOpacity: z.number().int().min(0).max(90),
  heroText: hex,
  heroTitleIt: text(120),
  heroTitleEn: text(120),
  heroSubtitleIt: text(400),
  heroSubtitleEn: text(400),
  heroShowCta: z.boolean(),
  heroCtaIt: text(40),
  heroCtaEn: text(40),
  // schede dei pacchetti
  pkgImageStyle: z.enum(["cover", "logo", "none"]),
  pkgCoverRatio: z.enum(["wide", "classic", "square"]),
  pkgColumns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  showRates: z.boolean(),
  // footer
  footerTextIt: text(300),
  footerTextEn: text(300),
});

export type Theme = z.infer<typeof themeSchema>;
export type ThemeKey = keyof Theme;

/** Default "Terracotta": moderno ma caldo. Gli altri preset ne ridefiniscono solo la parte visiva. */
export const DEFAULT_THEME: Theme = {
  logoUrl: "/presets/logo-portale.svg",
  logoHeight: 40,
  showName: true,
  primary: "#b4532a",
  accent: "#e0a458",
  neutral: "#7a6e66",
  pageBg: "#faf5ef",
  surface: "#ffffff",
  heading: "#3b2a20",
  headerBg: "#fffaf5",
  headerText: "#3b2a20",
  footerBg: "#3b2a20",
  footerText: "#f3e6d8",
  headingFont: "fraunces",
  bodyFont: "dmSans",
  baseSize: 16,
  headingWeight: 600,
  radius: 16,
  buttonShape: "pill",
  shadow: "soft",
  cardBorder: true,
  cardAccentBar: false,
  width: "normal",
  headerSticky: true,
  headerShadow: false,
  heroEnabled: true,
  heroImage: "/presets/banner-terracotta.svg",
  heroHeight: "md",
  heroAlign: "left",
  heroFullWidth: true,
  heroOverlay: "#2b1a12",
  heroOverlayOpacity: 30,
  heroText: "#fffaf3",
  heroTitleIt: "",
  heroTitleEn: "",
  heroSubtitleIt: "",
  heroSubtitleEn: "",
  heroShowCta: true,
  heroCtaIt: "Scopri i corsi",
  heroCtaEn: "Discover the courses",
  pkgImageStyle: "cover",
  pkgCoverRatio: "wide",
  pkgColumns: 3,
  showRates: true,
  footerTextIt: "",
  footerTextEn: "",
};

/** Chiavi che un preset sovrascrive: tutto ciò che è visivo, mai i testi né il logo. */
export const VISUAL_KEYS = [
  "primary", "accent", "neutral", "pageBg", "surface", "heading", "headerBg", "headerText", "footerBg", "footerText",
  "headingFont", "bodyFont", "headingWeight", "radius", "buttonShape", "shadow", "cardBorder", "cardAccentBar",
  "heroImage", "heroOverlay", "heroOverlayOpacity", "heroText",
] as const satisfies readonly ThemeKey[];

export type Preset = { id: string; name: string; values: Pick<Theme, (typeof VISUAL_KEYS)[number]> };

const pickVisual = (t: Theme) => Object.fromEntries(VISUAL_KEYS.map((k) => [k, t[k]])) as Preset["values"];

export const PRESETS: Preset[] = [
  { id: "terracotta", name: "Terracotta", values: pickVisual(DEFAULT_THEME) },
  {
    id: "miele",
    name: "Miele",
    values: {
      primary: "#9a5b13", accent: "#f2c14e", neutral: "#7d7363", pageBg: "#fffaf0", surface: "#ffffff",
      heading: "#3d2c12", headerBg: "#3d2c12", headerText: "#fff4dc", footerBg: "#f6ead2", footerText: "#4a3a1f",
      headingFont: "playfair", bodyFont: "nunito", headingWeight: 700, radius: 12, buttonShape: "rounded",
      shadow: "medium", cardBorder: false, cardAccentBar: true,
      heroImage: "/presets/banner-miele.svg", heroOverlay: "#3d2c12", heroOverlayOpacity: 25, heroText: "#fffaf0",
    },
  },
  {
    id: "salvia",
    name: "Salvia",
    values: {
      primary: "#4f7a5a", accent: "#d98e5f", neutral: "#6f7268", pageBg: "#f5f3ec", surface: "#fffefb",
      heading: "#263529", headerBg: "#f5f3ec", headerText: "#263529", footerBg: "#263529", footerText: "#e8efe6",
      headingFont: "lora", bodyFont: "jakarta", headingWeight: 600, radius: 20, buttonShape: "pill",
      shadow: "soft", cardBorder: true, cardAccentBar: false,
      heroImage: "/presets/banner-salvia.svg", heroOverlay: "#1f2b22", heroOverlayOpacity: 35, heroText: "#f7f5ee",
    },
  },
  {
    id: "rosa",
    name: "Rosa antico",
    values: {
      primary: "#a64d5e", accent: "#e8a87c", neutral: "#7b6c6e", pageBg: "#fbf4f2", surface: "#ffffff",
      heading: "#3f2329", headerBg: "#ffffff", headerText: "#3f2329", footerBg: "#f3e3df", footerText: "#5a3a40",
      headingFont: "dmSerif", bodyFont: "manrope", headingWeight: 400, radius: 8, buttonShape: "rounded",
      shadow: "medium", cardBorder: true, cardAccentBar: true,
      heroImage: "/presets/banner-tramonto.svg", heroOverlay: "#3f2329", heroOverlayOpacity: 30, heroText: "#fff7f3",
    },
  },
];

/** Legge un tema salvato tollerando chiavi mancanti o non più valide: ognuna ricade sul default. */
export function parseTheme(raw: unknown): Theme {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_THEME } as Record<string, unknown>;
  for (const [key, schema] of Object.entries(themeSchema.shape)) {
    const r = (schema as z.ZodTypeAny).safeParse(src[key]);
    if (r.success) out[key] = r.data;
  }
  return out as Theme;
}

/* ---------- colori ---------- */

type RGB = [number, number, number];

export function hexToRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const channels = (c: RGB) => c.join(" ");

/** Scala 50–950 a partire dal colore dato, che diventa la tonalità `base`. */
function scale(h: string, base: 500 | 600): Record<number, RGB> {
  const c = hexToRgb(h);
  const light: Record<number, number> = base === 600
    ? { 50: 0.93, 100: 0.85, 200: 0.7, 300: 0.5, 400: 0.28, 500: 0.12 }
    : { 50: 0.95, 100: 0.9, 200: 0.8, 300: 0.62, 400: 0.35 };
  const dark: Record<number, number> = base === 600
    ? { 700: 0.18, 800: 0.34, 900: 0.5, 950: 0.65 }
    : { 600: 0.18, 700: 0.35, 800: 0.55, 900: 0.72, 950: 0.82 };
  const out: Record<number, RGB> = { [base]: c };
  for (const [k, t] of Object.entries(light)) out[+k] = mix(c, WHITE, t);
  for (const [k, t] of Object.entries(dark)) out[+k] = mix(c, BLACK, t);
  return out;
}

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Coppie di colori sotto il minimo WCAG AA per il testo normale (4,5:1). */
export function contrastWarnings(t: Theme): { key: string; ratio: number }[] {
  const pairs: [string, string, string][] = [
    ["buttons", t.primary, "#ffffff"],
    ["heading", t.heading, t.pageBg],
    ["header", t.headerText, t.headerBg],
    ["footer", t.footerText, t.footerBg],
  ];
  // con un'immagine il fondo del banner non è calcolabile: si controlla solo il banner a tinta unita
  if (t.heroEnabled && !t.heroImage) pairs.push(["hero", t.heroText, t.primary]);
  return pairs
    .map(([key, a, b]) => ({ key, ratio: Math.round(contrast(a, b) * 10) / 10 }))
    .filter((w) => w.ratio < 4.5);
}

/* ---------- variabili CSS ---------- */

const SHADOWS = {
  none: "none",
  soft: "0 1px 2px rgb(var(--slate-900) / 0.04), 0 4px 16px rgb(var(--slate-900) / 0.05)",
  medium: "0 2px 4px rgb(var(--slate-900) / 0.06), 0 10px 28px rgb(var(--slate-900) / 0.09)",
  strong: "0 4px 8px rgb(var(--slate-900) / 0.08), 0 18px 44px rgb(var(--slate-900) / 0.16)",
};

const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};
const SERIF_FONTS: FontKey[] = ["fraunces", "playfair", "lora", "dmSerif"];

function fontStack(f: FontKey): string {
  const fallback = SERIF_FONTS.includes(f) ? FONT_STACKS.serif : FONT_STACKS.sans;
  return f === "system" ? fallback : `var(--font-${f}), ${fallback}`;
}

export function themeVars(t: Theme): Record<string, string> {
  const v: Record<string, string> = {};
  for (const [k, c] of Object.entries(scale(t.primary, 600))) v[`--brand-${k}`] = channels(c);
  for (const [k, c] of Object.entries(scale(t.accent, 500))) v[`--accent-${k}`] = channels(c);
  for (const [k, c] of Object.entries(scale(t.neutral, 500))) v[`--slate-${k}`] = channels(c);
  for (const k of ["pageBg", "surface", "heading", "headerBg", "headerText", "footerBg", "footerText"] as const) {
    v[`--${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`] = channels(hexToRgb(t[k]));
  }
  v["--radius"] = `${t.radius}px`;
  v["--input-radius"] = `${Math.min(t.radius, 12)}px`;
  v["--btn-radius"] = t.buttonShape === "pill" ? "9999px" : t.buttonShape === "square" ? "0px" : `${Math.min(t.radius, 12)}px`;
  v["--shadow-card"] = SHADOWS[t.shadow];
  v["--card-border"] = t.cardBorder ? "1px" : "0px";
  v["--font-heading"] = fontStack(t.headingFont);
  v["--font-body"] = fontStack(t.bodyFont);
  v["--heading-weight"] = String(t.headingWeight);
  v["--base-size"] = `${t.baseSize}px`;
  return v;
}

export function themeCss(t: Theme): string {
  return `:root{${Object.entries(themeVars(t)).map(([k, val]) => `${k}:${val}`).join(";")}}`;
}

/* ---------- classi Tailwind (letterali, perché il JIT le trovi) ---------- */

export const WIDTH_CLASS = { narrow: "max-w-5xl", normal: "max-w-6xl", wide: "max-w-7xl" } as const;
export const HERO_HEIGHT_CLASS = { sm: "min-h-[220px]", md: "min-h-[320px]", lg: "min-h-[440px]", xl: "min-h-[560px]" } as const;
export const COVER_RATIO_CLASS = { wide: "aspect-[16/9]", classic: "aspect-[4/3]", square: "aspect-square" } as const;
export const COLUMNS_CLASS = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as const;
