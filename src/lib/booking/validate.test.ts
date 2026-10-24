import { describe, expect, it } from "vitest";
import { groupLessons, validateSelection, type PackageRules } from "./validate";
import { SLOT_MS, slotsForDay, zonedInstant } from "@/lib/time";

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
    // una lezione da 1 ora al posto di una da 45 minuti
    const wrong = [...days.slice(0, 7).flat(), ...run("2026-11-27", "17:00", 4)];
    const r = validateSelection({ ...rules, totalSlots: 25 }, wrong);
    expect(codes(r)).toContain("LESSON_TOO_LONG");
    expect(r.errors.find((e) => e.code === "LESSON_TOO_LONG")?.params).toMatchObject({ max: 45 });
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
