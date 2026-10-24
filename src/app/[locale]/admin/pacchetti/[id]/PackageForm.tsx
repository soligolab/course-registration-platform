"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Package } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { deletePackage, savePackage, type FormState } from "@/app/actions/admin";
import { MediaPicker } from "@/components/MediaPicker";
import { formatDuration, formatPrice, packageLessons, type Rate } from "@/lib/pricing";

export function PackageForm({ pkg, rates, locale }: { pkg: Package | null; rates: Rate[]; locale: string }) {
  const t = useTranslations("admin.packages");
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(savePackage, {});
  const [deleting, startDelete] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const bad = new Set(state.errors ?? []);
  const current = pkg ? packageLessons(pkg) : null;
  const [imageUrl, setImageUrl] = useState(pkg?.imageUrl ?? "");
  const [count, setCount] = useState(current?.count ?? 4);
  const [minutes, setMinutes] = useState(current?.minutes ?? rates.find((r) => r.minutes === 60)?.minutes ?? rates[0].minutes);
  const rate = rates.find((r) => r.minutes === minutes)?.priceCents;

  useEffect(() => {
    if (state.ok) router.push("/admin/pacchetti");
  }, [state, router]);

  const field = (name: string, type = "text", defaultValue?: string | number | null, extra: object = {}) => (
    <div>
      <label htmlFor={name} className="label">
        {t(name as "nameIt")}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className={`input ${bad.has(name) ? "input-error" : ""}`}
        {...extra}
      />
    </div>
  );

  return (
    <form
      // invio manuale: con <form action> React 19 svuota i campi dopo l'invio, anche se ci sono errori
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-4"
    >
      {pkg && <input type="hidden" name="id" value={pkg.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("nameIt", "text", pkg?.nameIt, { required: true })}
        {field("nameEn", "text", pkg?.nameEn, { required: true })}
      </div>
      {(["descriptionIt", "descriptionEn"] as const).map((name) => (
        <div key={name}>
          <label htmlFor={name} className="label">
            {t(name)}
          </label>
          <textarea id={name} name={name} rows={2} className="input" defaultValue={pkg?.[name] ?? ""} />
        </div>
      ))}
      {pkg && !current && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{t("variableLegacy")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lessonsCount" className="label">
            {t("lessonsCount")}
          </label>
          <input
            id="lessonsCount"
            name="lessonsCount"
            type="number"
            min={1}
            max={200}
            required
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`input ${bad.has("lessonsCount") ? "input-error" : ""}`}
          />
        </div>
        <div>
          <label htmlFor="lessonMinutes" className="label">
            {t("lessonMinutes")}
          </label>
          <select
            id="lessonMinutes"
            name="lessonMinutes"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={`input ${bad.has("lessonMinutes") ? "input-error" : ""}`}
          >
            {rates.map((r) => (
              <option key={r.minutes} value={r.minutes}>
                {formatDuration(r.minutes)}
                {r.priceCents != null ? ` · ${formatPrice(r.priceCents, locale)}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        {t("summary", { n: count || 0, duration: formatDuration(minutes), hours: ((count || 0) * minutes) / 60 })}{" "}
        {rate != null ? (
          <strong>{t("total", { price: formatPrice((count || 0) * rate, locale) })}</strong>
        ) : (
          <span className="text-amber-700">{t("noRate")}</span>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("validityDays", "number", pkg?.validityDays ?? 31, { min: 1, required: true })}
        {field("maxLessonsPerWeek", "number", pkg?.maxLessonsPerWeek, { min: 1 })}
        {field("sortOrder", "number", pkg?.sortOrder ?? 0)}
      </div>
      <div>
        <span className="label">{t("imageUrl")}</span>
        <MediaPicker kind="logo" name="imageUrl" value={imageUrl} onChange={setImageUrl} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={pkg?.active ?? true} />
        {t("active")}
      </label>

      {state.errors && <p className="text-sm text-red-600">{t("invalid", { fields: state.errors.map((f) => (t.has(f as "nameIt") ? t(f as "nameIt") : f)).join(", ") })}</p>}
      {info && <p className="text-sm text-amber-700">{info}</p>}

      <div className="flex justify-between">
        <button className="btn-primary" disabled={pending}>
          {t("save")}
        </button>
        {pkg && (
          <button
            type="button"
            className="btn-danger"
            disabled={deleting}
            onClick={() =>
              confirm(`${t("delete")}?`) &&
              startDelete(async () => {
                const res = await deletePackage(pkg.id);
                if (res.deactivated) setInfo(t("deactivated"));
                else router.push("/admin/pacchetti");
                router.refresh();
              })
            }
          >
            {t("delete")}
          </button>
        )}
      </div>
    </form>
  );
}
