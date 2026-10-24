import { SLOT_MINUTES, SLOT_MS, dayKey, daysBetween, isoWeekKey, timeLabel, weekdayIndex } from "@/lib/time";

export type PackageRules = {
  totalSlots: number;
  minLessonSlots: number;
  maxLessonSlots: number;
  /** ogni lezione deve durare un multiplo di questo numero di slot (con slot da 15 min: 4 = blocchi da 1 ora) */
  lessonStepSlots: number;
  validityDays: number;
  maxLessonsPerWeek: number | null;
  /** fasce settimanali in cui il pacchetto si può prenotare; vuoto o assente = sempre */
  timeWindows?: TimeWindow[];
};

/** Fascia oraria settimanale, ora di Roma: weekday come weekdayIndex (lunedì = 0), "HH:mm". */
export type TimeWindow = { weekday: number; from: string; to: string };

/** Lezione già fissata (di gruppo) a cui ci si può unire: va scelta per intero. */
export type JoinableLesson = { start: string; slotCount: number };

/** `joined`: la lezione coincide con una lezione già fissata a cui ci si unisce. */
export type Lesson = { day: string; start: string; slots: string[]; joined?: boolean };

/** I parametri degli errori sono in minuti: gli slot sono un dettaglio interno. */
export type ValidationError =
  | { code: "DUPLICATE_SLOT"; params: { time: string } }
  | { code: "COUNT_MISMATCH"; params: { selected: number; required: number } }
  | { code: "LESSON_TOO_SHORT"; params: { day: string; time: string; min: number } }
  | { code: "LESSON_TOO_LONG"; params: { day: string; time: string; max: number } }
  | { code: "LESSON_STEP"; params: { day: string; time: string; step: number } }
  | { code: "OUTSIDE_VALIDITY"; params: { days: number } }
  | { code: "TOO_MANY_PER_WEEK"; params: { day: string; max: number } }
  | { code: "SLOT_UNAVAILABLE"; params: { day: string; time: string } }
  | { code: "OUTSIDE_WINDOW"; params: { day: string; time: string } };

export type ValidationResult = { ok: boolean; errors: ValidationError[]; lessons: Lesson[] };

/**
 * Raggruppa slot consecutivi dello stesso giorno in lezioni. Input in qualsiasi ordine.
 * Con `size` (durata fissa del pacchetto) una sequenza più lunga diventa più lezioni attaccate.
 */
export function groupLessons(slots: string[], size?: number): Lesson[] {
  const sorted = [...new Set(slots)].sort((a, b) => Date.parse(a) - Date.parse(b));
  const lessons: Lesson[] = [];
  for (const s of sorted) {
    const last = lessons[lessons.length - 1];
    const prev = last?.slots[last.slots.length - 1];
    const full = size != null && last != null && last.slots.length >= size;
    if (last && prev && !full && Date.parse(s) - Date.parse(prev) === SLOT_MS && dayKey(s) === last.day) {
      last.slots.push(s);
    } else {
      lessons.push({ day: dayKey(s), start: s, slots: [s] });
    }
  }
  return lessons;
}

/** Durata fissa delle lezioni del pacchetto (in slot), se min = max. */
export function fixedLessonSlots(rules: Pick<PackageRules, "minLessonSlots" | "maxLessonSlots">): number | undefined {
  return rules.minLessonSlots === rules.maxLessonSlots ? rules.maxLessonSlots : undefined;
}

const minutesOf = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** La lezione sta tutta dentro una delle fasce? Senza fasce: sempre. */
export function inTimeWindows(lesson: Pick<Lesson, "day" | "start" | "slots">, windows: TimeWindow[] | undefined): boolean {
  if (!windows?.length) return true;
  const wd = weekdayIndex(lesson.day);
  const from = minutesOf(timeLabel(lesson.start));
  // fine in ora locale (giusta anche nella notte del cambio d'ora); "00:00" = mezzanotte di fine giornata
  const to = minutesOf(timeLabel(new Date(Date.parse(lesson.slots[lesson.slots.length - 1]) + SLOT_MS))) || 24 * 60;
  return windows.some((w) => w.weekday === wd && minutesOf(w.from) <= from && to <= minutesOf(w.to));
}

/**
 * Valida una selezione di slot rispetto alle regole del pacchetto.
 * `freeSlots`, se fornito, è l'insieme degli slot ISO effettivamente prenotabili
 * (disponibili, non già presi, oltre il preavviso minimo).
 * `joinable` sono le lezioni già fissate con posti liberi: una lezione che coincide con una di esse
 * è un'iscrizione (non serve che gli slot siano liberi né dentro le fasce); una che le tocca solo in parte no.
 * Le lezioni di gruppo esistono solo per pacchetti a durata fissa (vedi joinableLessons): con durata
 * variabile una lezione attaccata a un'iscrizione verrebbe unita a essa.
 */
export function validateSelection(
  rules: PackageRules,
  slots: string[],
  freeSlots?: Set<string>,
  joinable: JoinableLesson[] = [],
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

  const lessons = groupLessons(normalized, fixedLessonSlots(rules));
  const joinKeys = new Set(joinable.map((j) => `${new Date(j.start).toISOString()}/${j.slotCount}`));
  for (const l of lessons) if (joinKeys.has(`${l.start}/${l.slots.length}`)) l.joined = true;

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

  for (const l of lessons) {
    if (!l.joined && !inTimeWindows(l, rules.timeWindows)) {
      errors.push({ code: "OUTSIDE_WINDOW", params: { day: l.day, time: timeLabel(l.start) } });
    }
  }

  if (freeSlots) {
    for (const l of lessons) {
      if (l.joined) continue;
      for (const s of l.slots) {
        if (!freeSlots.has(s)) {
          errors.push({ code: "SLOT_UNAVAILABLE", params: { day: dayKey(s), time: timeLabel(s) } });
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, lessons };
}
