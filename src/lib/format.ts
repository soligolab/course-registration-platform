import { SLOT_MS, TZ } from "@/lib/time";

const tag = (locale: string) => (locale === "en" ? "en-GB" : "it-IT");

/** Formatta un giorno "YYYY-MM-DD" (es. "lunedì 2 novembre 2026"). */
export function formatDay(day: string, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "full" }) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(tag(locale), { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatShortDay(day: string, locale: string) {
  return formatDay(day, locale, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Nome del mese "YYYY-MM" (es. "novembre 2026"). */
export function formatMonth(month: string, locale: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(tag(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Nomi brevi dei giorni della settimana a partire da lunedì. */
export function weekdayNames(locale: string, style: "short" | "long" = "short") {
  const fmt = new Intl.DateTimeFormat(tag(locale), { weekday: style, timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 1/1/2024 = lunedì
}

export function formatDateTime(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(
    new Date(date),
  );
}

export function formatTime(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(tag(locale), { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(date),
  );
}

/** Fine di una lezione = inizio dell'ultimo slot + 30 minuti. */
export function lessonEnd(lastSlot: string) {
  return new Date(Date.parse(lastSlot) + SLOT_MS);
}
