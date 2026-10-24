"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { requestOtp, verifyOtp } from "@/app/actions/auth";
import { useErrorMessage } from "@/components/ErrorList";
import { safeNext } from "@/lib/nav";

export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp(email, locale);
      if (res.ok) setStep("code");
      else setError(errorMessage({ code: res.error }));
    } catch {
      setError(errorMessage({ code: "generic" }));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(email, code, locale);
      if (!res.ok) {
        setError(errorMessage({ code: res.error }));
        return;
      }
      // i dati del cliente si chiedono solo quando invia una richiesta (vedi BookingClient)
      router.push(safeNext(next) ?? (res.isAdmin ? "/admin" : "/"));
      router.refresh();
    } catch {
      setError(errorMessage({ code: "generic" }));
    } finally {
      setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div>
          <label htmlFor="email" className="label">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {t("sendCode")}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
    >
      <p className="text-sm text-slate-600">{t("sent", { email })}</p>
      <div>
        <label htmlFor="code" className="label">
          {t("code")}
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className="input text-center text-2xl tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {t("verify")}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-brand-600 hover:underline" onClick={() => setStep("email")}>
          {t("changeEmail")}
        </button>
        <button type="button" className="text-brand-600 hover:underline" disabled={busy} onClick={send}>
          {t("resend")}
        </button>
      </div>
    </form>
  );
}
