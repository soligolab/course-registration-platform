import { z } from "zod";
import type { Package } from "@prisma/client";
import type { PackageRules, TimeWindow } from "@/lib/booking/validate";
import { SLOT_MINUTES } from "@/lib/time";

/* Fasce orarie settimanali dei pacchetti (Package.timeWindowsJson). Condiviso tra client e server. */

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const onGrid = (s: string) => Number(s.slice(3, 5)) % SLOT_MINUTES === 0;

export const timeWindowsSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), from: hm.refine(onGrid), to: hm.refine(onGrid) })
      .refine((w) => w.from < w.to),
  )
  .max(50);

export function parseTimeWindows(json: string | null | undefined): TimeWindow[] {
  try {
    const parsed = timeWindowsSchema.safeParse(JSON.parse(json || "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Regole di prenotazione di un pacchetto, fasce comprese. */
export function packageRules(pkg: Package): PackageRules {
  return {
    totalSlots: pkg.totalSlots,
    minLessonSlots: pkg.minLessonSlots,
    maxLessonSlots: pkg.maxLessonSlots,
    lessonStepSlots: pkg.lessonStepSlots,
    validityDays: pkg.validityDays,
    maxLessonsPerWeek: pkg.maxLessonsPerWeek,
    timeWindows: parseTimeWindows(pkg.timeWindowsJson),
  };
}
