"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveRatesPageAction } from "@/app/actions/admin";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { RatesPage } from "@/lib/settings";

/** Testi della sezione Tariffe in home: titolo, sottotitolo e descrizione ricca, in italiano e inglese. */
export function RatesPageForm({ page }: { page: RatesPage }) {
  const t = useTranslations("admin.ratesPage");
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget)) as RatesPage;
        setMsg(null);
        start(async () => {
          const res = await saveRatesPageAction(data);
          setMsg(res.ok ? { ok: true, text: t("saved") } : { ok: false, text: t("invalid") });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div>
        <h2 className="text-lg">{t("title")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("hint")}</p>
      </div>
      {(["It", "En"] as const).map((lang) => (
        <div key={lang} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`title${lang}`}>
              {t(`title${lang}`)}
            </label>
            <input id={`title${lang}`} name={`title${lang}`} className="input" maxLength={120} placeholder={t(`defaultTitle${lang}`)} defaultValue={page[`title${lang}`]} />
          </div>
          <div>
            <label className="label" htmlFor={`subtitle${lang}`}>
              {t(`subtitle${lang}`)}
            </label>
            <input id={`subtitle${lang}`} name={`subtitle${lang}`} className="input" maxLength={300} placeholder={t(`defaultSubtitle${lang}`)} defaultValue={page[`subtitle${lang}`]} />
          </div>
        </div>
      ))}
      {(["It", "En"] as const).map((lang) => (
        <div key={lang}>
          <span className="label">{t(`details${lang}`)}</span>
          <RichTextEditor name={`details${lang}`} initial={page[`details${lang}`]} label={t(`details${lang}`)} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {t("save")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
