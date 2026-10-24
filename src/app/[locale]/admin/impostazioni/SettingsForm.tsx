"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveSettingsAction, type FormState } from "@/app/actions/admin";
import type { Settings } from "@/lib/settings";

const FIELDS: { name: keyof Settings; type?: string; multiline?: boolean }[] = [
  { name: "businessName" },
  { name: "ownerName", multiline: true },
  { name: "ownerContact" },
  { name: "adminNotifyEmail", type: "email" },
  { name: "minNoticeHours", type: "number" },
  { name: "dayStart", type: "time" },
  { name: "dayEnd", type: "time" },
];

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("admin.settings");
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettingsAction, {});
  const bad = new Set(state.errors ?? []);

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
      {FIELDS.map(({ name, type = "text", multiline }) => (
        <div key={name}>
          <label htmlFor={name} className="label">
            {t(name)}
          </label>
          {multiline ? (
            <textarea id={name} name={name} rows={3} defaultValue={settings[name]} className={`input ${bad.has(name) ? "input-error" : ""}`} />
          ) : (
            <input
              id={name}
              name={name}
              type={type}
              step={type === "time" ? 900 : undefined}
              defaultValue={settings[name]}
              className={`input ${bad.has(name) ? "input-error" : ""}`}
            />
          )}
        </div>
      ))}
      {state.errors && <p className="text-sm text-red-600">{t("invalid", { fields: state.errors.map((f) => (t.has(f as "title") ? t(f as "title") : f)).join(", ") })}</p>}
      {state.ok && <p className="text-sm text-emerald-700">{t("saved")}</p>}
      <button className="btn-primary" disabled={pending}>
        {t("save")}
      </button>
    </form>
  );
}
