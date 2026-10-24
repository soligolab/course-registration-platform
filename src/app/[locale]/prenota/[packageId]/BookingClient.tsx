"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { getFreeMonth, submitBooking } from "@/app/actions/booking";
import { validateSelection, type PackageRules, type ValidationError } from "@/lib/booking/validate";
import { packageLessons } from "@/lib/pricing";
import { SLOT_MINUTES, SLOT_MS, addMonths, dayKey } from "@/lib/time";
import { formatDay, formatShortDay, formatTime, lessonEnd } from "@/lib/format";
import { MonthCalendar } from "@/components/MonthCalendar";
import { ErrorList, useErrorMessage } from "@/components/ErrorList";

type Props = {
  pkg: PackageRules & { id: string };
  initialMonth: string;
  loggedIn: boolean;
  profileComplete: boolean;
  autoSubmit: boolean;
};

const storageKey = (id: string) => `booking:${id}`;

export function BookingClient({ pkg, initialMonth, loggedIn, profileComplete, autoSubmit }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();

  const [month, setMonth] = useState(initialMonth);
  const [free, setFree] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<ValidationError[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // ripristina la selezione salvata (sopravvive al login)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(pkg.id)) ?? "null");
      if (saved?.slots) setSelected(saved.slots);
      if (saved?.notes) setNotes(saved.notes);
    } catch {}
    setRestored(true);
  }, [pkg.id]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(storageKey(pkg.id), JSON.stringify({ slots: selected, notes }));
    } catch {}
  }, [pkg.id, selected, notes, restored]);

  const loadMonth = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const slots = await getFreeMonth(m);
      setFree((f) => ({ ...f, [m]: slots }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!(month in free)) loadMonth(month);
  }, [month, free, loadMonth]);

  const freeByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of free[month] ?? []) {
      const d = dayKey(s);
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return map;
  }, [free, month]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedDays = useMemo(() => new Set(selected.map(dayKey)), [selected]);

  const validation = useMemo(() => validateSelection(pkg, selected), [pkg, selected]);
  const liveErrors = validation.errors.filter((e) => e.code !== "COUNT_MISMATCH");
  const complete = selected.length === pkg.totalSlots && validation.ok;

  // Si seleziona per blocchi di `lessonStepSlots` slot a partire dall'orario cliccato (inizio ogni SLOT_MINUTES).
  const step = Math.max(1, pkg.lessonStepSlots);
  const fixedLessons = packageLessons(pkg);
  const freeSet = useMemo(() => new Set(Object.values(free).flat()), [free]);
  const blockFrom = (slot: string) =>
    Array.from({ length: step }, (_, i) => new Date(Date.parse(slot) + i * SLOT_MS).toISOString());
  const canStartBlock = (slot: string) =>
    selected.length + step <= pkg.totalSlots && blockFrom(slot).every((s) => freeSet.has(s) && !selectedSet.has(s));

  function toggle(slot: string) {
    setServerErrors([]);
    setServerMessage(null);
    if (selectedSet.has(slot)) {
      // rimuove il blocco (allineato all'inizio della lezione) che contiene lo slot
      const lesson = validation.lessons.find((l) => l.slots.includes(slot));
      if (!lesson) return;
      const from = Math.floor(lesson.slots.indexOf(slot) / step) * step;
      const remove = new Set(lesson.slots.slice(from, from + step));
      setSelected((cur) => cur.filter((s) => !remove.has(s)));
    } else if (canStartBlock(slot)) {
      setSelected((cur) => [...cur, ...blockFrom(slot)].sort());
    }
  }

  function removeLesson(slots: string[]) {
    setSelected((cur) => cur.filter((s) => !slots.includes(s)));
  }

  // di ritorno da login/profilo (?invia=1): invia automaticamente la selezione salvata
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!autoSubmit || autoTried || !restored || !loggedIn || !profileComplete) return;
    setAutoTried(true);
    window.history.replaceState(null, "", window.location.pathname);
    if (complete) submit();
  }, [autoSubmit, autoTried, restored, loggedIn, profileComplete, complete]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    const back = `/prenota/${pkg.id}?invia=1`;
    if (!loggedIn) return router.push(`/accedi?next=${encodeURIComponent(back)}`);
    if (!profileComplete) return router.push(`/profilo?next=${encodeURIComponent(back)}`);
    setSubmitting(true);
    setServerErrors([]);
    setServerMessage(null);
    try {
      const res = await submitBooking({ packageId: pkg.id, slots: selected, notes });
      if (res.ok) {
        try {
          localStorage.removeItem(storageKey(pkg.id));
        } catch {}
        router.push("/richiesta-inviata");
        return;
      }
      if (res.details?.length) setServerErrors(res.details);
      else setServerMessage(errorMessage({ code: res.error }));
      // ricarica le disponibilità: qualcosa potrebbe essere cambiato
      setFree({});
    } catch {
      setServerMessage(errorMessage({ code: "generic" }));
    } finally {
      setSubmitting(false);
    }
  }

  const today = dayKey(new Date());
  const daySlots = day ? [...new Set([...(freeByDay.get(day) ?? []), ...selected.filter((s) => dayKey(s) === day)])].sort() : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <MonthCalendar
          month={month}
          canGoPrev={month > initialMonth}
          onMonthChange={(d) => {
            setMonth(addMonths(month, d));
            setDay(null);
          }}
          selectedDay={day}
          onSelectDay={setDay}
          loading={loading}
          dayState={(d) => {
            const hasFree = freeByDay.has(d);
            const hasSel = selectedDays.has(d);
            return {
              disabled: d < today || (!hasFree && !hasSel),
              tone: hasSel ? "bg-brand-600 text-white font-semibold" : hasFree ? "bg-emerald-100 text-emerald-900" : "",
            };
          }}
        />
        <div className="flex gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-100" /> {t("legendFree")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-brand-600" /> {t("legendSelected")}
          </span>
        </div>

        <div className="card">
          {!day ? (
            <p className="text-sm text-slate-500">{t("pickDay")}</p>
          ) : (
            <>
              <h3 className="font-semibold first-letter:uppercase">{t("slotsOf", { date: formatDay(day, locale) })}</h3>
              <p className="mb-3 text-xs text-slate-500">{t("blockHint", { minutes: step * SLOT_MINUTES })}</p>
              {daySlots.length === 0 ? (
                <p className="text-sm text-slate-500">{t("noSlots")}</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {daySlots.map((s) => {
                    const isSel = selectedSet.has(s);
                    const blocked = !isSel && !canStartBlock(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={blocked}
                        title={isSel ? undefined : `${formatTime(s, locale)}–${formatTime(new Date(Date.parse(s) + step * SLOT_MS), locale)}`}
                        onClick={() => toggle(s)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                          isSel
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        }`}
                      >
                        {formatTime(s, locale)}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="card space-y-4">
          <h3 className="font-semibold">{t("summary")}</h3>
          <div>
            <div className="mb-1 text-sm">{fixedLessons
                ? t("counterLessons", { selected: selected.length / step, required: fixedLessons.count })
                : t("counter", { selected: (selected.length * SLOT_MINUTES) / 60, required: (pkg.totalSlots * SLOT_MINUTES) / 60 })}</div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full ${complete ? "bg-emerald-500" : "bg-brand-500"}`}
                style={{ width: `${Math.min(100, (selected.length / pkg.totalSlots) * 100)}%` }}
              />
            </div>
            {selected.length >= pkg.totalSlots && <p className="mt-1 text-xs text-slate-500">{t("full")}</p>}
          </div>

          {validation.lessons.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noneSelected")}</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {validation.lessons.map((l) => (
                <li key={l.start} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1">
                  <button type="button" className="text-left first-letter:uppercase hover:underline" onClick={() => setDay(l.day)}>
                    {formatShortDay(l.day, locale)} {formatTime(l.start, locale)}–
                    {formatTime(lessonEnd(l.slots[l.slots.length - 1]), locale)}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => removeLesson(l.slots)}
                    aria-label={t("remove")}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ErrorList errors={[...liveErrors, ...serverErrors]} />
          {serverMessage && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{serverMessage}</p>}

          {selected.length > 0 && (
            <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setSelected([])}>
              {t("clear")}
            </button>
          )}

          <div>
            <label className="label" htmlFor="notes">
              {t("notes")}
            </label>
            <textarea id="notes" className="input" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <button type="button" className="btn-primary w-full" disabled={!complete || submitting} onClick={submit}>
            {submitting ? t("submitting") : t("submit")}
          </button>
          <p className="text-xs text-slate-500">{t("disclaimer")}</p>
          {!loggedIn && <p className="text-xs text-slate-500">{t("loginFirst")}</p>}
        </div>
      </aside>
    </div>
  );
}
