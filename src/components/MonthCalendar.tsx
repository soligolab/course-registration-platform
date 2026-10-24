"use client";

import { useLocale, useTranslations } from "next-intl";
import { daysInMonth, weekdayIndex } from "@/lib/time";
import { formatMonth, weekdayNames } from "@/lib/format";

export type DayState = {
  disabled?: boolean;
  /** classi Tailwind per lo sfondo del giorno */
  tone?: string;
  badge?: string;
};

export function MonthCalendar({
  month,
  onMonthChange,
  canGoPrev = true,
  selectedDay,
  onSelectDay,
  dayState,
  loading,
}: {
  month: string;
  onMonthChange: (delta: number) => void;
  canGoPrev?: boolean;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  dayState: (day: string) => DayState;
  loading?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("calendar");
  const days = daysInMonth(month);
  const lead = weekdayIndex(days[0]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary px-3 py-1"
          onClick={() => onMonthChange(-1)}
          disabled={!canGoPrev}
          aria-label={t("prev")}
        >
          ‹
        </button>
        <h2 className="text-base font-semibold capitalize">{formatMonth(month, locale)}</h2>
        <button type="button" className="btn-secondary px-3 py-1" onClick={() => onMonthChange(1)} aria-label={t("next")}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-slate-500">
        {weekdayNames(locale).map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className={`grid grid-cols-7 gap-1 ${loading ? "opacity-50" : ""}`}>
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((day) => {
          const s = dayState(day);
          const selected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              disabled={s.disabled}
              onClick={() => onSelectDay(day)}
              className={`relative flex h-12 sm:h-14 flex-col items-center justify-center rounded-lg text-sm transition
                ${s.disabled ? "cursor-default text-slate-300" : "hover:ring-2 hover:ring-brand-500"}
                ${s.tone ?? ""}
                ${selected ? "ring-2 ring-brand-600" : ""}`}
            >
              <span>{Number(day.slice(8))}</span>
              {s.badge && <span className="text-[10px] leading-none text-slate-600">{s.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
