import { z } from "zod";
import { SLOT_MINUTES } from "@/lib/time";

/*
 * Tariffario: prezzo per lezione in base alla durata. Ogni pacchetto ha una durata fissa
 * (minLessonSlots = maxLessonSlots = lessonStepSlots): lezioni × tariffa è il suo prezzo di base;
 * il prezzo del pacchetto (Package.priceCents) lo sostituisce e la differenza si mostra come sconto.
 * Prezzi in centesimi; null = non ancora fissato.
 */

/** label/text: nome e testo breve della scheda nella sezione Tariffe della home. */
export type Rate = {
  minutes: number;
  priceCents: number | null;
  labelIt?: string;
  labelEn?: string;
  textIt?: string;
  textEn?: string;
};

export const DEFAULT_RATES: Rate[] = [
  { minutes: 45, priceCents: null },
  { minutes: 60, priceCents: null },
  { minutes: 90, priceCents: null },
];

export const rateSchema = z.object({
  minutes: z.number().int().min(SLOT_MINUTES).max(480).refine((m) => m % SLOT_MINUTES === 0),
  priceCents: z.number().int().min(0).max(1_000_000).nullable(),
  labelIt: z.string().trim().max(60).default(""),
  labelEn: z.string().trim().max(60).default(""),
  textIt: z.string().trim().max(300).default(""),
  textEn: z.string().trim().max(300).default(""),
});

export const ratesSchema = z
  .array(rateSchema)
  .min(1)
  .max(12)
  .refine((rs) => new Set(rs.map((r) => r.minutes)).size === rs.length, { message: "DUPLICATE" });

export function parseRates(raw: unknown): Rate[] {
  const r = ratesSchema.safeParse(raw);
  return r.success ? [...r.data].sort((a, b) => a.minutes - b.minutes) : DEFAULT_RATES;
}

type PackageShape = { totalSlots: number; minLessonSlots: number; maxLessonSlots: number };

/** Lezioni di un pacchetto a durata fissa; null se la durata è variabile (pacchetti vecchi). */
export function packageLessons(pkg: PackageShape): { count: number; minutes: number } | null {
  if (pkg.minLessonSlots !== pkg.maxLessonSlots || pkg.totalSlots % pkg.minLessonSlots !== 0) return null;
  return { count: pkg.totalSlots / pkg.minLessonSlots, minutes: pkg.minLessonSlots * SLOT_MINUTES };
}

/** Prezzo di un insieme di lezioni (durate in minuti); null se manca la tariffa di una durata. */
export function priceForLessons(minutes: number[], rates: Rate[]): number | null {
  let total = 0;
  for (const m of minutes) {
    const rate = rates.find((r) => r.minutes === m)?.priceCents;
    if (rate == null) return null;
    total += rate;
  }
  return total;
}

/** Prezzo di base del pacchetto: lezioni × tariffa; null se manca la tariffa o la durata è variabile. */
export function basePrice(pkg: PackageShape, rates: Rate[]): number | null {
  const l = packageLessons(pkg);
  return l ? priceForLessons(Array(l.count).fill(l.minutes), rates) : null;
}

export type PackagePricing = {
  /** prezzo del pacchetto: quello configurato, altrimenti la base; null se non c'è nessuno dei due */
  price: number | null;
  /** base da mostrare barrata, solo se c'è uno sconto */
  base: number | null;
  discountPct: number | null;
};

export function packagePricing(pkg: PackageShape & { priceCents: number | null }, rates: Rate[]): PackagePricing {
  const base = basePrice(pkg, rates);
  const price = pkg.priceCents ?? base;
  if (pkg.priceCents == null || base == null || price == null || base <= price) return { price, base: null, discountPct: null };
  return { price, base, discountPct: Math.round(((base - price) / base) * 100) };
}

export function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "45 min", "1 h", "1 h 30" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
