import { describe, expect, it } from "vitest";
import { fixedLessonSlots, groupLessons, inTimeWindows, validateSelection, type PackageRules, type TimeWindow } from "./validate";
import { SLOT_MS, dayKey, slotsForDay, zonedInstant } from "@/lib/time";

const fourHours: PackageRules = {
  totalSlots: 8,
  minLessonSlots: 2,
  maxLessonSlots: 4,
  lessonStepSlots: 1,
  validityDays: 31,
  maxLessonsPerWeek: null,
};

const weekly: PackageRules = {
  totalSlots: 6,
  minLessonSlots: 2,
  maxLessonSlots: 2,
  lessonStepSlots: 2,
  validityDays: 183,
  maxLessonsPerWeek: 1,
};

/** n slot consecutivi a partire da giorno + ora locale di Roma. */
function run(day: string, hm: string, n: number): string[] {
  const start = zonedInstant(day, hm).getTime();
  return Array.from({ length: n }, (_, i) => new Date(start + i * SLOT_MS).toISOString());
}

const codes = (r: ReturnType<typeof validateSelection>) => r.errors.map((e) => e.code);

describe("groupLessons", () => {
  it("raggruppa slot consecutivi dello stesso giorno", () => {
    const slots = [...run("2026-11-02", "10:00", 2), ...run("2026-11-02", "15:00", 3)];
    const lessons = groupLessons(slots.reverse());
    expect(lessons.map((l) => l.slots.length)).toEqual([2, 3]);
  });

  it("non unisce slot a cavallo della mezzanotte", () => {
    const slots = run("2026-11-02", "23:45", 2);
    expect(groupLessons(slots)).toHaveLength(2);
  });
});

describe("validateSelection", () => {
  it("pacchetto 8 lezioni da 45 minuti: durata fissa", () => {
    const rules: PackageRules = { totalSlots: 24, minLessonSlots: 3, maxLessonSlots: 3, lessonStepSlots: 3, validityDays: 31, maxLessonsPerWeek: null };
    const days = ["03", "05", "10", "12", "17", "19", "24", "26"].map((d) => run(`2026-11-${d}`, "17:15", 3));
    expect(validateSelection(rules, days.flat()).ok).toBe(true);
    // un'ora al posto di 45 minuti: con durata fissa diventa una lezione da 45 + una da 15, troppo corta
    const wrong = [...days.slice(0, 7).flat(), ...run("2026-11-27", "17:00", 4)];
    const r = validateSelection({ ...rules, totalSlots: 25 }, wrong);
    expect(codes(r)).toContain("LESSON_TOO_SHORT");
    expect(r.errors.find((e) => e.code === "LESSON_TOO_SHORT")?.params).toMatchObject({ min: 45 });
  });

  it("accetta una selezione valida", () => {
    const slots = [...run("2026-11-02", "10:00", 4), ...run("2026-11-10", "18:00", 2), ...run("2026-11-20", "09:00", 2)];
    expect(validateSelection(fourHours, slots).ok).toBe(true);
  });

  it("segnala numero di slot errato", () => {
    const r = validateSelection(fourHours, run("2026-11-02", "10:00", 4));
    expect(codes(r)).toContain("COUNT_MISMATCH");
  });

  it("segnala lezioni troppo corte o troppo lunghe", () => {
    const short = [...run("2026-11-02", "10:00", 1), ...run("2026-11-03", "10:00", 4), ...run("2026-11-04", "10:00", 3)];
    expect(codes(validateSelection(fourHours, short))).toEqual(["LESSON_TOO_SHORT"]);
    const long = [...run("2026-11-02", "10:00", 6), ...run("2026-11-03", "10:00", 2)];
    expect(codes(validateSelection(fourHours, long))).toEqual(["LESSON_TOO_LONG"]);
  });

  it("con blocchi da 1 ora rifiuta lezioni da 1h30 anche se tra min e max", () => {
    const hourly = { ...fourHours, lessonStepSlots: 2 };
    const bad = [...run("2026-11-02", "10:00", 3), ...run("2026-11-03", "10:30", 5)];
    expect(codes(validateSelection(hourly, bad))).toEqual(["LESSON_STEP", "LESSON_TOO_LONG", "LESSON_STEP"]);
    // inizio alla mezz'ora consentito, purché la durata sia a blocchi interi
    const good = [...run("2026-11-02", "10:30", 2), ...run("2026-11-03", "15:30", 4), ...run("2026-11-04", "09:00", 2)];
    expect(validateSelection(hourly, good).ok).toBe(true);
  });

  it("segnala lezioni oltre il periodo di validità", () => {
    const slots = [...run("2026-11-01", "10:00", 4), ...run("2026-12-02", "10:00", 4)];
    expect(codes(validateSelection(fourHours, slots))).toEqual(["OUTSIDE_VALIDITY"]);
    const edge = [...run("2026-11-01", "10:00", 4), ...run("2026-12-01", "10:00", 4)];
    expect(validateSelection(fourHours, edge).ok).toBe(true);
  });

  it("rispetta il massimo di lezioni a settimana", () => {
    // lunedì 2 e mercoledì 4 novembre 2026 sono nella stessa settimana ISO
    const bad = [...run("2026-11-02", "10:00", 2), ...run("2026-11-04", "10:00", 2), ...run("2026-11-16", "10:00", 2)];
    expect(codes(validateSelection(weekly, bad))).toEqual(["TOO_MANY_PER_WEEK"]);
    const good = [...run("2026-11-02", "10:00", 2), ...run("2026-11-09", "10:00", 2), ...run("2026-11-16", "10:00", 2)];
    expect(validateSelection(weekly, good).ok).toBe(true);
  });

  it("segnala slot non disponibili", () => {
    const slots = [...run("2026-11-02", "10:00", 4), ...run("2026-11-03", "10:00", 4)];
    const free = new Set(slotsForDay("2026-11-02"));
    const r = validateSelection(fourHours, slots, free);
    expect(codes(r)).toEqual(["SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE"]);
  });

  it("segnala duplicati", () => {
    const s = run("2026-11-02", "10:00", 2);
    const r = validateSelection({ ...fourHours, totalSlots: 2 }, [...s, s[0]]);
    expect(codes(r)).toContain("DUPLICATE_SLOT");
  });

  it("gestisce il cambio ora legale (25 ottobre 2026)", () => {
    const slots = slotsForDay("2026-10-25", "01:00", "04:00");
    // la griglia segue l'orario locale: 12 orari da 15 min, nessun duplicato nell'ora ripetuta
    expect(slots).toHaveLength(12);
    expect(new Set(slots).size).toBe(12);
  });
});

/** Pacchetto a durata fissa: lezioni da 1 ora (4 slot). */
const hourly: PackageRules = {
  totalSlots: 8,
  minLessonSlots: 4,
  maxLessonSlots: 4,
  lessonStepSlots: 4,
  validityDays: 31,
  maxLessonsPerWeek: null,
};

/** Lezione singola costruita come in groupLessons. */
const lesson = (day: string, hm: string, n: number) => {
  const slots = run(day, hm, n);
  return { day: dayKey(slots[0]), start: slots[0], slots };
};

describe("fixedLessonSlots / groupLessons con durata fissa", () => {
  it("durata fissa solo se min = max", () => {
    expect(fixedLessonSlots(hourly)).toBe(4);
    expect(fixedLessonSlots(fourHours)).toBeUndefined();
  });

  it("due lezioni attaccate (15:00–17:00) sono due lezioni distinte", () => {
    const slots = run("2026-11-02", "15:00", 8);
    const lessons = groupLessons(slots, 4);
    expect(lessons.map((l) => l.slots.length)).toEqual([4, 4]);
    expect(lessons[1].start).toBe(zonedInstant("2026-11-02", "16:00").toISOString());
    const r = validateSelection(hourly, slots);
    expect(r.ok).toBe(true);
    expect(r.lessons).toHaveLength(2);
  });

  it("una sequenza di 6 slot diventa [4, 2]: lezione troppo corta", () => {
    const slots = run("2026-11-02", "15:00", 6);
    expect(groupLessons(slots, 4).map((l) => l.slots.length)).toEqual([4, 2]);
    const r = validateSelection({ ...hourly, totalSlots: 6 }, slots);
    expect(codes(r)).toEqual(["LESSON_TOO_SHORT", "LESSON_STEP"]);
  });

  it("senza size la sequenza resta unica", () => {
    expect(groupLessons(run("2026-11-02", "15:00", 8)).map((l) => l.slots.length)).toEqual([8]);
    // pacchetto non a durata fissa: 8 slot attaccati = una lezione da 2 ore, troppo lunga
    expect(codes(validateSelection(fourHours, run("2026-11-02", "15:00", 8)))).toEqual(["LESSON_TOO_LONG"]);
  });

  it("anche con size non unisce slot a cavallo della mezzanotte", () => {
    const lessons = groupLessons(run("2026-11-02", "23:30", 4), 4);
    expect(lessons.map((l) => [l.day, l.slots.length])).toEqual([["2026-11-02", 2], ["2026-11-03", 2]]);
  });
});

describe("fasce orarie (timeWindows)", () => {
  // lunedì 2 novembre 2026 = weekday 0
  const monday: TimeWindow[] = [{ weekday: 0, from: "17:00", to: "19:00" }];
  const rules: PackageRules = { ...hourly, totalSlots: 4, timeWindows: monday };

  it("notte del passaggio all'ora legale: la fine è in ora locale", () => {
    // 29/03/2026: 01:30, 01:45, 03:00, 03:15 → la lezione finisce alle 03:30 locali, fuori da una fascia fino alle 03:00
    const sunday: TimeWindow[] = [{ weekday: 6, from: "01:00", to: "03:00" }];
    expect(inTimeWindows(lesson("2026-03-29", "01:30", 4), sunday)).toBe(false);
  });

  it("lezione dentro la fascia: ok", () => {
    expect(inTimeWindows(lesson("2026-11-02", "17:00", 4), monday)).toBe(true);
    expect(validateSelection(rules, run("2026-11-02", "17:30", 4)).ok).toBe(true);
  });

  it("lezione che finisce esattamente alla fine della fascia: ok", () => {
    expect(inTimeWindows(lesson("2026-11-02", "18:00", 4), monday)).toBe(true);
    expect(validateSelection(rules, run("2026-11-02", "18:00", 4)).ok).toBe(true);
  });

  it("lezione che sborda di 15 minuti: errore", () => {
    expect(inTimeWindows(lesson("2026-11-02", "18:15", 4), monday)).toBe(false);
    const late = validateSelection(rules, run("2026-11-02", "18:15", 4));
    expect(codes(late)).toEqual(["OUTSIDE_WINDOW"]);
    expect(late.errors[0].params).toEqual({ day: "2026-11-02", time: "18:15" });
    // anche prima dell'inizio
    expect(codes(validateSelection(rules, run("2026-11-02", "16:45", 4)))).toEqual(["OUTSIDE_WINDOW"]);
  });

  it("giorno della settimana sbagliato: errore", () => {
    // martedì 3 novembre, stesso orario
    expect(inTimeWindows(lesson("2026-11-03", "17:00", 4), monday)).toBe(false);
    expect(codes(validateSelection(rules, run("2026-11-03", "17:00", 4)))).toEqual(["OUTSIDE_WINDOW"]);
  });

  it("domenica è weekday 6", () => {
    const sunday: TimeWindow[] = [{ weekday: 6, from: "10:00", to: "12:00" }];
    expect(inTimeWindows(lesson("2026-11-08", "10:00", 4), sunday)).toBe(true);
    expect(inTimeWindows(lesson("2026-11-02", "10:00", 4), sunday)).toBe(false);
  });

  it("fasce vuote o assenti: nessun vincolo", () => {
    const l = lesson("2026-11-03", "06:00", 4);
    expect(inTimeWindows(l, [])).toBe(true);
    expect(inTimeWindows(l, undefined)).toBe(true);
    expect(validateSelection({ ...rules, timeWindows: [] }, l.slots).ok).toBe(true);
    expect(validateSelection({ ...rules, timeWindows: undefined }, l.slots).ok).toBe(true);
  });

  it("più fasce nello stesso giorno: la lezione deve stare tutta in una sola", () => {
    const split: TimeWindow[] = [
      { weekday: 0, from: "09:00", to: "12:00" },
      { weekday: 0, from: "12:00", to: "14:00" },
      { weekday: 0, from: "15:00", to: "16:00" },
    ];
    expect(inTimeWindows(lesson("2026-11-02", "11:00", 4), split)).toBe(true);
    expect(inTimeWindows(lesson("2026-11-02", "12:00", 4), split)).toBe(true);
    expect(inTimeWindows(lesson("2026-11-02", "15:00", 4), split)).toBe(true);
    // a cavallo di due fasce contigue: non sta tutta in nessuna delle due
    expect(inTimeWindows(lesson("2026-11-02", "11:30", 4), split)).toBe(false);
    // a cavallo del buco 14:00–15:00
    expect(inTimeWindows(lesson("2026-11-02", "14:30", 4), split)).toBe(false);
    const r = validateSelection({ ...hourly, timeWindows: split }, [...run("2026-11-02", "09:00", 4), ...run("2026-11-02", "11:30", 4)]);
    expect(codes(r)).toEqual(["OUTSIDE_WINDOW"]);
  });

  it("lezione che finisce a mezzanotte con fascia fino alle 24:00", () => {
    const night: TimeWindow[] = [{ weekday: 0, from: "22:00", to: "24:00" }];
    expect(inTimeWindows(lesson("2026-11-02", "23:00", 4), night)).toBe(true);
  });

  it("cambio d'ora (25 ottobre 2026): conta l'ora locale di Roma", () => {
    const windows: TimeWindow[] = [
      { weekday: 0, from: "17:00", to: "18:00" },
      { weekday: 6, from: "10:00", to: "12:00" },
    ];
    const r = { ...hourly, totalSlots: 12, validityDays: 31, timeWindows: windows };
    // lunedì 19 ottobre (ora legale), domenica 25 (giorno del cambio, ora solare), lunedì 26 (ora solare)
    const before = run("2026-10-19", "17:00", 4);
    const sunday = run("2026-10-25", "11:00", 4);
    const after = run("2026-10-26", "17:00", 4);
    // stessa ora locale, istanti UTC diversi
    expect(before[0].slice(11, 16)).toBe("15:00");
    expect(after[0].slice(11, 16)).toBe("16:00");
    expect(sunday[0].slice(11, 16)).toBe("10:00");
    expect(validateSelection(r, [...before, ...sunday, ...after]).ok).toBe(true);
    // lunedì 26 alle 17:00 UTC = 18:00 locali: fuori fascia (con l'ora legale sarebbe stato dentro)
    const utc17 = Array.from({ length: 4 }, (_, i) => new Date(Date.parse("2026-10-26T17:00:00.000Z") + i * SLOT_MS).toISOString());
    const bad = validateSelection(r, [...before, ...sunday, ...utc17]);
    expect(codes(bad)).toEqual(["OUTSIDE_WINDOW"]);
    expect(bad.errors[0].params).toEqual({ day: "2026-10-26", time: "18:00" });
  });
});

describe("iscrizione a lezioni già fissate (joinable)", () => {
  const group = run("2026-11-02", "15:00", 4);
  const joinable = [{ start: group[0], slotCount: 4 }];
  const one = { ...hourly, totalSlots: 4 };

  it("lezione che coincide con una joinable: joined, anche senza slot liberi", () => {
    const r = validateSelection(one, group, new Set(), joinable);
    expect(r.ok).toBe(true);
    expect(r.lessons).toEqual([expect.objectContaining({ start: group[0], joined: true })]);
  });

  it("senza joinable gli stessi slot non sono disponibili", () => {
    const r = validateSelection(one, group, new Set());
    expect(codes(r)).toEqual(Array(4).fill("SLOT_UNAVAILABLE"));
    expect(r.lessons[0].joined).toBeUndefined();
  });

  it("joinable fuori dalle fasce: passa lo stesso", () => {
    const rules = { ...one, timeWindows: [{ weekday: 2, from: "09:00", to: "10:00" }] };
    expect(validateSelection(rules, group, new Set(), joinable).ok).toBe(true);
    // la stessa lezione senza iscrizione è fuori fascia
    expect(codes(validateSelection(rules, group, new Set(group)))).toEqual(["OUTSIDE_WINDOW"]);
  });

  it("sovrapposizione parziale (15 minuti dopo): SLOT_UNAVAILABLE", () => {
    const shifted = run("2026-11-02", "15:15", 4);
    const r = validateSelection(one, shifted, new Set(), joinable);
    expect(r.lessons[0].joined).toBeUndefined();
    expect(codes(r)).toEqual(Array(4).fill("SLOT_UNAVAILABLE"));
  });

  it("stesso inizio ma durata diversa: non è un'iscrizione", () => {
    const r = validateSelection({ ...fourHours, totalSlots: 2 }, group.slice(0, 2), new Set(), joinable);
    expect(r.lessons[0].joined).toBeUndefined();
    expect(codes(r)).toEqual(["SLOT_UNAVAILABLE", "SLOT_UNAVAILABLE"]);
  });

  it("lezioni nuove e iscrizioni nella stessa selezione", () => {
    const fresh = run("2026-11-04", "10:00", 4);
    const r = validateSelection(hourly, [...fresh, ...group], new Set(fresh), joinable);
    expect(r.ok).toBe(true);
    expect(r.lessons.map((l) => !!l.joined)).toEqual([true, false]);
  });

  it("lezione nuova attaccata a un'iscrizione, con durata fissa", () => {
    // 14:00–15:00 nuova + 15:00–16:00 di gruppo: due lezioni distinte
    const fresh = run("2026-11-02", "14:00", 4);
    const r = validateSelection(hourly, [...fresh, ...group], new Set(fresh), joinable);
    expect(r.ok).toBe(true);
    expect(r.lessons.map((l) => !!l.joined)).toEqual([false, true]);
  });

  it("start della joinable con o senza millisecondi", () => {
    const noMs = group[0].replace(".000Z", "Z");
    expect(noMs).not.toBe(group[0]);
    expect(validateSelection(one, group, new Set(), [{ start: noMs, slotCount: 4 }]).ok).toBe(true);
    expect(validateSelection(one, group, new Set(), [{ start: group[0], slotCount: 4 }]).ok).toBe(true);
    // anche gli slot selezionati senza millisecondi
    expect(validateSelection(one, group.map((s) => s.replace(".000Z", "Z")), new Set(), joinable).ok).toBe(true);
  });

  it("le iscrizioni contano per il massimo settimanale e la validità", () => {
    const fresh = run("2026-11-04", "10:00", 4);
    const r = validateSelection({ ...hourly, maxLessonsPerWeek: 1 }, [...fresh, ...group], new Set(fresh), joinable);
    expect(codes(r)).toEqual(["TOO_MANY_PER_WEEK"]);
  });
});
