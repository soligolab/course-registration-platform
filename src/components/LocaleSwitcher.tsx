"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { routing, usePathname, useRouter } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();

  return (
    <select
      aria-label={t("language")}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
      value={locale}
      onChange={(e) => {
        const qs = search.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: e.target.value });
        router.refresh();
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
