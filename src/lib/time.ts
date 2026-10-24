import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TZ = "Europe/Rome";
export const SLOT_MINUTES = 15;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;

/** "YYYY-MM-DD" del giorno (ora di Roma) in cui cade l'istante. */
export function dayKey(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM-dd");
}

/** "HH:mm" (ora di Roma). */
export function timeLabel(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "HH:mm");
}

/** "YYYY-MM" del mese (ora di Roma). */
export function monthKey(date: Date | string): string {
  return formatInTimeZone(new Date(date), TZ, "yyyy-MM");
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Istante UTC corrispondente a giorno + ora locale di Roma. */
export function zonedInstant(day: string, hm: string): Date {
  return fromZonedTime(`${day}T${hm}:00`, TZ);
}

/** Tutti gli slot (ISO UTC) del giorno tra dayStart (incluso) e dayEnd (escluso), ore locali. */
export function slotsForDay(day: string, dayStart = "07:00", dayEnd = "22:00"): string[] {
  const out: string[] = [];
  for (let m = parseHm(dayStart); m + SLOT_MINUTES <= parseHm(dayEnd); m += SLOT_MINUTES) {
    out.push(zonedInstant(day, `${pad(Math.floor(m / 60))}:${pad(m % 60)}`).toISOString());
  }
  return out;
}

/** Inizio (incluso) e fine (esclusa) del mese "YYYY-MM" in ora di Roma, come istanti UTC. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return { start: zonedInstant(`${month}-01`, "00:00"), end: zonedInstant(`${next}-01`, "00:00") };
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Giorni del mese "YYYY-MM" come "YYYY-MM-DD". */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** Giorno della settimana con lunedì = 0 ... domenica = 6. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Differenza in giorni di calendario tra due "YYYY-MM-DD" (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** Chiave settimana ISO "YYYY-Www" per un giorno "YYYY-MM-DD". */
export function isoWeekKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}
