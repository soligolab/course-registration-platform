"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { saveProfile, type ProfileState } from "@/app/actions/auth";
import { safeNext } from "@/lib/nav";
import { Modal } from "@/components/Modal";
import type { Billing } from "@/lib/billing";
import { BillingFields } from "./BillingFields";

type Initial = {
  email: string;
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  guardianName: string;
  privacyAccepted: boolean;
  billing: Billing | null;
};

export function ProfileForm({ initial, next }: { initial: Initial; next: string | null }) {
  const t = useTranslations("profile");
  const tl = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [age, setAge] = useState(initial.age);
  const minor = age !== "" && Number(age) < 14;
  const bad = new Set(state.errors ?? []);
  const cls = (f: string) => `input ${bad.has(f) ? "input-error" : ""}`;

  const target = safeNext(next);
  const formRef = useRef<HTMLFormElement>(null);
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSavedOpen(true);
      router.refresh();
    } else if (state.errors) {
      // porta in vista il primo campo da correggere, altrimenti il clic sembra non fare nulla
      const first = formRef.current?.querySelector<HTMLElement>(".input-error, [data-form-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus({ preventScroll: true });
    }
  }, [state, router]);

  // per "usa i dati dell'allievo" nei dati di fatturazione
  const student = () => ({
    firstName: (document.getElementById("firstName") as HTMLInputElement | null)?.value ?? "",
    lastName: (document.getElementById("lastName") as HTMLInputElement | null)?.value ?? "",
  });
  const billingErrors = [...bad].some((e) => e.startsWith("b_"));

  return (
    <>
    <form
      ref={formRef}
      // invio manuale: con <form action> React 19 svuota i campi dopo l'invio, anche se ci sono errori
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label">{tl("email")}</label>
        <input className="input bg-slate-100" value={initial.email} disabled />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">
            {t("firstName")}
          </label>
          <input id="firstName" name="firstName" required maxLength={80} autoComplete="given-name" className={cls("firstName")} defaultValue={initial.firstName} />
        </div>
        <div>
          <label htmlFor="lastName" className="label">
            {t("lastName")}
          </label>
          <input id="lastName" name="lastName" required maxLength={80} autoComplete="family-name" className={cls("lastName")} defaultValue={initial.lastName} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="age" className="label">
            {t("age")}
          </label>
          <input
            id="age"
            name="age"
            type="number"
            min={3}
            max={120}
            required
            className={cls("age")}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            {t("phone")}
          </label>
          <input id="phone" name="phone" type="tel" required autoComplete="tel" className={cls("phone")} defaultValue={initial.phone} />
        </div>
      </div>

      {minor && (
        <fieldset className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <legend className="px-1 text-sm font-semibold text-amber-900">{t("guardianTitle")}</legend>
          <div>
            <label htmlFor="guardianName" className="label">
              {t("guardianName")}
            </label>
            <input id="guardianName" name="guardianName" required className={cls("guardianName")} defaultValue={initial.guardianName} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="guardianConsent" required className="mt-1" />
            <span>{t("guardianConsent")}</span>
          </label>
        </fieldset>
      )}

      <BillingFields initial={initial.billing} errors={bad} student={student} />

      <label className={`flex items-start gap-2 text-sm ${bad.has("privacy") ? "text-red-700" : ""}`}>
        <input type="checkbox" name="privacy" required className="mt-1" defaultChecked={initial.privacyAccepted} />
        <span>
          {t.rich("privacy", {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" className="text-brand-600 underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      {state.errors && <p data-form-error className="text-sm text-red-600">{billingErrors ? t("invalidBilling") : t("invalid")}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {t("save")}
      </button>
    </form>

    <Modal open={savedOpen} onClose={() => setSavedOpen(false)} title={t("savedTitle")}>
      <p className="text-sm text-slate-600">{target ? t("savedBodyNext") : t("savedBody")}</p>
      <div className="flex justify-end gap-2">
        {target ? (
          <button type="button" className="btn-primary" onClick={() => router.push(target)}>
            {t("continue")}
          </button>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={() => setSavedOpen(false)}>
              {t("close")}
            </button>
            <button type="button" className="btn-primary" onClick={() => router.push("/")}>
              {t("browseCourses")}
            </button>
          </>
        )}
      </div>
    </Modal>
    </>
  );
}
