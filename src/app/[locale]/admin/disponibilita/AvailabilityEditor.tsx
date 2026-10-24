"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { applyToSameWeekday, getAdminMonth, setDayAvailability, type AdminMonth } from "@/app/actions/admin";
import { SLOT_MINUTES, addMonths, dayKey, slotsForDay, timeLabel } from "@/lib/time";
import { formatDay, weekdayNames } from "@/lib/format";
import { weekdayIndex } from "@/lib/time";
import { MonthCalendar } from "@/components/MonthCalendar";

export function AvailabilityEditor({
  initialMonth,
  dayStart,
  dayEnd,
}: {
  initialMonth: string;
  dayStart: string;
  dayEnd: string;
}) {
  const t = useTranslations("admin.availability");
  const locale = useLocale();
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<AdminMonth>({ available: [], booked: [] });
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      setData(await getAdminMonth(m));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const availableSet = useMemo(() => new Set(data.available), [data]);
  const bookedMap = useMemo(() => new Map(data.booked.map((b) => [b.startAt, b])), [data]);
  const countByDay = useMemo(() => {
    const m = new Map<string, { free: number; booked: number }>();
    for (const s of data.available) {
      const d = dayKey(s);
      const c = m.get(d) ?? { free: 0, booked: 0 };
      if (bookedMap.has(s)) c.booked++;
      else c.free++;
      m.set(d, c);
    }
    return m;
  }, [data, bookedMap]);

  function openDay(d: string) {
    if (dirty && !confirm(t("unsaved"))) return;
    setDay(d);
    setDraft(new Set(slotsForDay(d, dayStart, dayEnd).filter((s) => availableSet.has(s))));
    setDirty(false);
    setMessage(null);
  }

  // sincronizza la bozza quando i dati del mese vengono ricaricati
  useEffect(() => {
    if (day && !dirty) setDraft(new Set(slotsForDay(day, dayStart, dayEnd).filter((s) => availableSet.has(s))));
  }, [availableSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = day ? slotsForDay(day, dayStart, dayEnd) : [];
  const times = () => [...draft].sort().map(timeLabel);

  function toggle(s: string) {
    if (bookedMap.has(s)) return;
    setDraft((cur) => {
      const n = new Set(cur);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
    setDirty(true);
  }

  function setAll(on: boolean) {
    setDraft(new Set(grid.filter((s) => on || bookedMap.has(s))));
    setDirty(true);
  }

  const save = () =>
    start(async () => {
      await setDayAvailability(day!, times());
      setDirty(false);
      setMessage(t("saved"));
      await load(month);
    });

  const apply = (months: number) =>
    start(async () => {
      const n = await applyToSameWeekday(day!, times(), months);
      setDirty(false);
      setMessage(t("applied", { n }));
      await load(month);
    });

  const weekday = day ? weekdayNames(locale, "long")[weekdayIndex(day)] : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <MonthCalendar
        month={month}
        onMonthChange={(d) => {
          if (dirty && !confirm(t("unsaved"))) return;
          setMonth(addMonths(month, d));
          setDay(null);
          setDirty(false);
        }}
        selectedDay={day}
        onSelectDay={openDay}
        loading={loading}
        dayState={(d) => {
          const c = countByDay.get(d);
          if (!c) return {};
          return {
            tone: c.free > 0 ? "bg-emerald-100" : "bg-amber-100",
            badge: `${((c.free + c.booked) * SLOT_MINUTES) / 60}h${c.booked ? ` · ${(c.booked * SLOT_MINUTES) / 60}h ●` : ""}`,
          };
        }}
      />

      <div className="card">
        {!day ? (
          <p className="text-sm text-slate-500">{t("help")}</p>
        ) : (
          <>
            <h2 className="mb-3 font-semibold first-letter:uppercase">{t("day", { date: formatDay(day, locale) })}</h2>
            <div className="mb-3 flex gap-2 text-xs">
              <button type="button" className="btn-secondary px-2 py-1" onClick={() => setAll(true)}>
                {t("all")}
              </button>
              <button type="button" className="btn-secondary px-2 py-1" onClick={() => setAll(false)}>
                {t("none")}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {grid.map((s) => {
                const booked = bookedMap.get(s);
                const on = draft.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    title={booked ? t("booked", { name: booked.name }) : undefined}
                    className={`rounded-md border px-1 py-1.5 text-xs font-medium ${
                      booked
                        ? "cursor-not-allowed border-amber-400 bg-amber-200 text-amber-900"
                        : on
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-emerald-400"
                    }`}
                  >
                    {timeLabel(s)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-emerald-500" /> {t("legendAvailable")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-amber-200" /> {t("legendBooked")}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="btn-primary" disabled={pending || !dirty} onClick={save}>
                {t("save")}
              </button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => apply(1)}>
                {t("applyMonth", { weekday })}
              </button>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => apply(3)}>
                {t("apply3", { weekday })}
              </button>
            </div>
            {dirty && <p className="mt-2 text-xs text-amber-700">{t("unsaved")}</p>}
            {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
          </>
        )}
      </div>
    </div>
  );
}
