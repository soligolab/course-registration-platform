import { z } from "zod";
import { SLOT_MINUTES } from "@/lib/time";

/*
 * Tariffario: prezzo per lezione in base alla durata. Ogni pacchetto ha una durata fissa
 * (minLessonSlots = maxLessonSlots = lessonStepSlots), quindi il suo prezzo è
 * numero di lezioni × tariffa di quella durata. Prezzi in centesimi; null = non ancora fissato.
 */

export type Rate = { minutes: number; priceCents: number | null };

export const DEFAULT_RATES: Rate[] = [
  { minutes: 45, priceCents: null },
  { minutes: 60, priceCents: null },
  { minutes: 90, priceCents: null },
];

export const rateSchema = z.object({
  minutes: z.number().int().min(SLOT_MINUTES).max(480).refine((m) => m % SLOT_MINUTES === 0),
  priceCents: z.number().int().min(0).max(1_000_000).nullable(),
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

export function packagePrice(pkg: PackageShape, rates: Rate[]): number | null {
  const l = packageLessons(pkg);
  return l ? priceForLessons(Array(l.count).fill(l.minutes), rates) : null;
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
