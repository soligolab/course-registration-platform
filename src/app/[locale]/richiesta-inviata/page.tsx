import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

export default async function DonePage() {
  const t = await getTranslations("done");
  return (
    <div className="card mx-auto max-w-lg text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
        ✓
      </div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-slate-600">{t("text")}</p>
      <Link href="/le-mie-richieste" className="btn-primary mt-6">
        {t("myRequests")}
      </Link>
    </div>
  );
}
