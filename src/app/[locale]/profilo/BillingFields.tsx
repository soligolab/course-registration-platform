"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { COUNTRIES, isValidCodiceFiscale, isValidPartitaIva, type Billing } from "@/lib/billing";

type Values = Record<string, string>;

const EMPTY: Values = {
  type: "PRIVATE", firstName: "", lastName: "", companyName: "", taxCode: "", vatNumber: "",
  sdiCode: "", pec: "", street: "", zip: "", city: "", province: "", country: "IT",
};

/**
 * Dati per la fattura, dentro il modulo del profilo. I campi hanno prefisso "b_" (vedi saveProfile).
 * Il controllo di CF e P.IVA qui è solo un aiuto immediato: quello che conta è sul server.
 */
export function BillingFields({ initial, errors, student }: { initial: Billing | null; errors: Set<string>; student: () => { firstName: string; lastName: string } }) {
  const t = useTranslations("profile.billing");
  const locale = useLocale();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial as unknown as Values | null) });
  const set = (k: string) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const business = v.type === "BUSINESS";
  const it = v.country === "IT";

  const countryNames = useMemo(() => {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return COUNTRIES.map((c) => ({ code: c, name: dn.of(c) ?? c }));
  }, [locale]);

  // avvisi immediati (solo per l'Italia, dove il controllo è certo)
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "");
  const cfWarn = it && v.taxCode.trim() !== "" && !(business ? isValidPartitaIva(norm(v.taxCode)) || isValidCodiceFiscale(norm(v.taxCode)) : isValidCodiceFiscale(norm(v.taxCode)));
  const vatWarn = it && business && v.vatNumber.trim() !== "" && !isValidPartitaIva(norm(v.vatNumber).replace(/^IT/, ""));

  const field = (k: string, opts: { required?: boolean; maxLength?: number; autoComplete?: string; type?: string; placeholder?: string; upper?: boolean; warn?: boolean } = {}) => (
    <div>
      <label htmlFor={`b_${k}`} className="label">
        {t(`fields.${k}` as "fields.street")}
        {!opts.required && <span className="font-normal text-slate-400"> · {t("optional")}</span>}
      </label>
      <input
        id={`b_${k}`}
        name={`b_${k}`}
        type={opts.type ?? "text"}
        required={opts.required}
        maxLength={opts.maxLength}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        value={v[k]}
        onChange={set(k)}
        className={`input ${opts.upper ? "uppercase" : ""} ${errors.has(`b_${k}`) || opts.warn ? "input-error" : ""}`}
      />
      {(errors.has(`b_${k}`) || opts.warn) && t.has(`errors.${k}` as "errors.taxCode") && (
        <p className="mt-1 text-xs text-red-600">{t(`errors.${k}` as "errors.taxCode")}</p>
      )}
    </div>
  );

  return (
    <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold">{t("title")}</legend>
      <p className="-mt-1 text-xs text-slate-500">{t("intro")}</p>
      <input type="hidden" name="b_type" value={v.type} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("title")}>
        {(["PRIVATE", "BUSINESS"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={v.type === type}
            onClick={() => setV((cur) => ({ ...cur, type }))}
            className={`rounded-[var(--input-radius)] border px-3 py-2 text-left text-sm ${v.type === type ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-slate-300 bg-white hover:border-slate-400"}`}
          >
            {t(`type.${type}`)}
            <span className="block text-xs font-normal text-slate-500">{t(`typeHint.${type}`)}</span>
          </button>
        ))}
      </div>

      {business ? (
        <>
          {field("companyName", { required: true, maxLength: 160, autoComplete: "organization" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("vatNumber", { required: true, maxLength: 20, upper: true, placeholder: it ? "12345678901" : undefined, warn: vatWarn })}
            {field("taxCode", { maxLength: 16, upper: true, warn: cfWarn })}
          </div>
          {it && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("sdiCode", { maxLength: 7, upper: true, placeholder: "0000000" })}
              {field("pec", { type: "email", maxLength: 120 })}
            </div>
          )}
          {it && <p className="-mt-2 text-xs text-slate-500">{t("sdiHint")}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{t("holderHint")}</p>
            <button type="button" className="shrink-0 text-xs text-brand-700 underline" onClick={() => setV((cur) => ({ ...cur, ...student() }))}>
              {t("useStudent")}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("firstName", { required: true, maxLength: 80 })}
            {field("lastName", { required: true, maxLength: 80 })}
          </div>
          {field("taxCode", { required: it, maxLength: it ? 16 : 30, upper: true, placeholder: it ? "RSSMRA85T10A562S" : undefined, warn: cfWarn })}
        </>
      )}

      {field("street", { required: true, maxLength: 120, autoComplete: "street-address" })}
      <div className="grid gap-4 sm:grid-cols-[7rem_1fr_6rem]">
        {field("zip", { required: true, maxLength: 12, autoComplete: "postal-code", upper: true })}
        {field("city", { required: true, maxLength: 80, autoComplete: "address-level2" })}
        {it ? field("province", { required: true, maxLength: 2, upper: true, placeholder: "PD" }) : field("province", { maxLength: 40 })}
      </div>
      <div>
        <label htmlFor="b_country" className="label">
          {t("fields.country")}
        </label>
        <select id="b_country" name="b_country" value={v.country} onChange={set("country")} className="input">
          {countryNames.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
