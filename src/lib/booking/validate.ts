import { SLOT_MINUTES, SLOT_MS, dayKey, daysBetween, isoWeekKey, timeLabel } from "@/lib/time";

export type PackageRules = {
  totalSlots: number;
  minLessonSlots: number;
  maxLessonSlots: number;
  /** ogni lezione deve durare un multiplo di questo numero di slot (con slot da 15 min: 4 = blocchi da 1 ora) */
  lessonStepSlots: number;
  validityDays: number;
  maxLessonsPerWeek: number | null;
};

export type Lesson = { day: string; start: string; slots: string[] };

/** I parametri degli errori sono in minuti: gli slot sono un dettaglio interno. */
export type ValidationError =
  | { code: "DUPLICATE_SLOT"; params: { time: string } }
  | { code: "COUNT_MISMATCH"; params: { selected: number; required: number } }
  | { code: "LESSON_TOO_SHORT"; params: { day: string; time: string; min: number } }
  | { code: "LESSON_TOO_LONG"; params: { day: string; time: string; max: number } }
  | { code: "LESSON_STEP"; params: { day: string; time: string; step: number } }
  | { code: "OUTSIDE_VALIDITY"; params: { days: number } }
  | { code: "TOO_MANY_PER_WEEK"; params: { day: string; max: number } }
  | { code: "SLOT_UNAVAILABLE"; params: { day: string; time: string } };

export type ValidationResult = { ok: boolean; errors: ValidationError[]; lessons: Lesson[] };

/** Raggruppa slot consecutivi dello stesso giorno in lezioni. Input in qualsiasi ordine. */
export function groupLessons(slots: string[]): Lesson[] {
  const sorted = [...new Set(slots)].sort((a, b) => Date.parse(a) - Date.parse(b));
  const lessons: Lesson[] = [];
  for (const s of sorted) {
    const last = lessons[lessons.length - 1];
    const prev = last?.slots[last.slots.length - 1];
    if (last && prev && Date.parse(s) - Date.parse(prev) === SLOT_MS && dayKey(s) === last.day) {
      last.slots.push(s);
    } else {
      lessons.push({ day: dayKey(s), start: s, slots: [s] });
    }
  }
  return lessons;
}

/**
 * Valida una selezione di slot rispetto alle regole del pacchetto.
 * `freeSlots`, se fornito, è l'insieme degli slot ISO effettivamente prenotabili
 * (disponibili, non già presi, oltre il preavviso minimo).
 */
export function validateSelection(
  rules: PackageRules,
  slots: string[],
  freeSlots?: Set<string>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const normalized = slots.map((s) => new Date(s).toISOString());

  const seen = new Set<string>();
  for (const s of normalized) {
    if (seen.has(s)) errors.push({ code: "DUPLICATE_SLOT", params: { time: timeLabel(s) } });
    seen.add(s);
  }

  if (seen.size !== rules.totalSlots) {
    errors.push({
      code: "COUNT_MISMATCH",
      params: { selected: seen.size * SLOT_MINUTES, required: rules.totalSlots * SLOT_MINUTES },
    });
  }

  const lessons = groupLessons(normalized);

  for (const l of lessons) {
    const time = timeLabel(l.start);
    if (l.slots.length < rules.minLessonSlots) {
      errors.push({ code: "LESSON_TOO_SHORT", params: { day: l.day, time, min: rules.minLessonSlots * SLOT_MINUTES } });
    }
    if (l.slots.length > rules.maxLessonSlots) {
      errors.push({ code: "LESSON_TOO_LONG", params: { day: l.day, time, max: rules.maxLessonSlots * SLOT_MINUTES } });
    }
    if (rules.lessonStepSlots > 1 && l.slots.length % rules.lessonStepSlots !== 0) {
      errors.push({ code: "LESSON_STEP", params: { day: l.day, time, step: rules.lessonStepSlots * SLOT_MINUTES } });
    }
  }

  if (lessons.length > 0) {
    const span = daysBetween(lessons[0].day, lessons[lessons.length - 1].day);
    if (span >= rules.validityDays) {
      errors.push({ code: "OUTSIDE_VALIDITY", params: { days: rules.validityDays } });
    }
  }

  if (rules.maxLessonsPerWeek != null) {
    const perWeek = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const k = isoWeekKey(l.day);
      perWeek.set(k, [...(perWeek.get(k) ?? []), l]);
    }
    for (const ls of perWeek.values()) {
      if (ls.length > rules.maxLessonsPerWeek) {
        errors.push({ code: "TOO_MANY_PER_WEEK", params: { day: ls[0].day, max: rules.maxLessonsPerWeek } });
      }
    }
  }

  if (freeSlots) {
    for (const s of seen) {
      if (!freeSlots.has(s)) {
        errors.push({ code: "SLOT_UNAVAILABLE", params: { day: dayKey(s), time: timeLabel(s) } });
      }
    }
  }

  return { ok: errors.length === 0, errors, lessons };
}
