"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TimeWindow } from "@/lib/booking/validate";
import { SLOT_MINUTES } from "@/lib/time";

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const toHm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Fasce orarie settimanali del pacchetto; scrive il JSON in un input hidden (timeWindowsJson). */
export function TimeWindowsEditor({ initial, dayRange }: { initial: TimeWindow[]; dayRange: [string, string] }) {
  const t = useTranslations("admin.packages.windows");
  const locale = useLocale();
  const [rows, setRows] = useState<TimeWindow[]>(initial);

  // lunedì 2 novembre 2026 + i → nomi dei giorni nella lingua corrente, lunedì = 0 come weekdayIndex
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(Date.UTC(2026, 10, 2 + i))),
    [locale],
  );
  const times = useMemo(() => {
    const out: string[] = [];
    for (let m = toMinutes(dayRange[0]); m <= toMinutes(dayRange[1]); m += SLOT_MINUTES) out.push(toHm(m));
    return out;
  }, [dayRange]);

  const update = (i: number, patch: Partial<TimeWindow>) => setRows((r) => r.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from));

  return (
    <div className="space-y-2">
      <input type="hidden" name="timeWindowsJson" value={JSON.stringify(sorted)} />
      {rows.length === 0 && <p className="text-sm text-slate-500">{t("none")}</p>}
      {rows.map((w, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select className="input w-auto first-letter:uppercase" value={w.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })} aria-label={t("weekday")}>
            {weekdays.map((name, d) => (
              <option key={d} value={d}>
                {name}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-600">{t("from")}</span>
          <select className="input w-auto" value={w.from} onChange={(e) => update(i, { from: e.target.value })} aria-label={t("from")}>
            {times.slice(0, -1).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <span className="text-sm text-slate-600">{t("to")}</span>
          <select
            className={`input w-auto ${w.to <= w.from ? "input-error" : ""}`}
            value={w.to}
            onChange={(e) => update(i, { to: e.target.value })}
            aria-label={t("to")}
          >
            {times.slice(1).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
            {t("remove")}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary py-1.5"
        onClick={() => {
          const last = rows[rows.length - 1];
          setRows((r) => [...r, last ? { ...last, weekday: (last.weekday + 1) % 7 } : { weekday: 0, from: "15:00", to: "18:00" }]);
        }}
      >
        {t("add")}
      </button>
      <p className="text-xs text-slate-500">{t("hint")}</p>
    </div>
  );
}
