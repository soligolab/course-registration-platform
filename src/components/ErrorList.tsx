"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ValidationError } from "@/lib/booking/validate";
import { formatShortDay } from "@/lib/format";

/** Messaggi di errore di validazione localizzati. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  const locale = useLocale();
  return (e: ValidationError | { code: string; params?: Record<string, string | number> }) => {
    const params: Record<string, string | number> = { ...(e.params ?? {}) };
    if (typeof params.day === "string") params.day = formatShortDay(params.day, locale);
    return t.has(e.code as "generic") ? t(e.code as "generic", params) : t("generic");
  };
}

export function ErrorList({ errors }: { errors: ValidationError[] }) {
  const msg = useErrorMessage();
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {errors.map((e, i) => (
        <li key={i}>{msg(e)}</li>
      ))}
    </ul>
  );
}
