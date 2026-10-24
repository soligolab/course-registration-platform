import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, t] = await Promise.all([searchParams, getTranslations("login")]);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("intro")}</p>
      <div className="card mt-6">
        <LoginForm next={next ?? null} />
      </div>
    </div>
  );
}
