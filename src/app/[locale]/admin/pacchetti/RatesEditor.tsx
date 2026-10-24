"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveRatesAction } from "@/app/actions/admin";
import { formatDuration, type Rate } from "@/lib/pricing";

type Row = { minutes: string; price: string };

const toRow = (r: Rate): Row => ({
  minutes: String(r.minutes),
  price: r.priceCents == null ? "" : (r.priceCents / 100).toFixed(2).replace(/\.00$/, ""),
});

/** Tariffario: prezzo per lezione in base alla durata. Prezzo vuoto = non ancora fissato. */
export function RatesEditor({ rates }: { rates: Rate[] }) {
  const t = useTranslations("admin.rates");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(rates.map(toRow));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function save() {
    setMsg(null);
    const parsed: Rate[] = rows.map((r) => ({
      minutes: Number(r.minutes),
      priceCents: r.price.trim() === "" ? null : Math.round(Number(r.price.replace(",", ".")) * 100),
    }));
    if (parsed.some((r) => !Number.isFinite(r.minutes) || (r.priceCents != null && !Number.isFinite(r.priceCents)))) {
      return setMsg({ ok: false, text: t("errors.INVALID") });
    }
    start(async () => {
      const res = await saveRatesAction(parsed);
      if (res.ok) {
        setMsg({ ok: true, text: t("saved") });
        router.refresh();
      } else setMsg({ ok: false, text: t(`errors.${res.error ?? "INVALID"}` as "errors.INVALID") });
    });
  }

  return (
    <div className="card">
      <h2 className="text-lg">{t("title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("hint")}</p>
      <div className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              {i === 0 && <span className="label">{t("minutes")}</span>}
              <input
                type="number"
                min={15}
                step={15}
                value={r.minutes}
                onChange={(e) => set(i, { minutes: e.target.value })}
                className="input"
                aria-label={t("minutes")}
              />
            </div>
            <div className="w-36">
              {i === 0 && <span className="label">{t("price")}</span>}
              <input
                inputMode="decimal"
                placeholder={t("pricePlaceholder")}
                value={r.price}
                onChange={(e) => set(i, { price: e.target.value })}
                className="input"
                aria-label={t("price")}
              />
            </div>
            <span className="pb-2 text-sm text-slate-500">{Number(r.minutes) > 0 ? formatDuration(Number(r.minutes)) : ""}</span>
            {rows.length > 1 && (
              <button type="button" className="pb-2 text-sm text-red-600 hover:underline" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                {t("remove")}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, { minutes: "", price: "" }])}>
          + {t("add")}
        </button>
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>
          {t("save")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
