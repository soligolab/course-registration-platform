import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { packagePricing } from "@/lib/pricing";
import { PackagePrice } from "@/components/PackagePrice";
import { getRates, getRatesPage } from "@/lib/settings";
import { PackageFacts } from "@/components/PackageFacts";
import { syncSingleLessonPackages } from "@/lib/single-lessons";
import { RatesEditor } from "./RatesEditor";
import { RatesPageForm } from "./RatesPageForm";

export default async function AdminPackagesPage() {
  await requireAdminPage();
  const [t, locale, packages, rates, ratesPage] = await Promise.all([
    getTranslations("admin.packages"),
    getLocale(),
    prisma.package.findMany({ where: { kind: "PACKAGE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    // allinea le lezioni singole al tariffario (installazioni con tariffario salvato prima della funzione)
    getRates().then(async (r) => (await syncSingleLessonPackages(r), r)),
    getRatesPage(),
  ]);

  return (
    <div>
      <div className="mb-8 max-w-4xl space-y-6">
        <RatesEditor rates={rates} />
        <RatesPageForm page={ratesPage} />
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t("title")}</h1>
        <Link href="/admin/pacchetti/nuovo" className="btn-primary">
          + {t("new")}
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => {
          const pricing = packagePricing(p, rates);
          return (
            <Link key={p.id} href={`/admin/pacchetti/${p.id}`} className={`card block hover:ring-2 hover:ring-brand-500 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold">{locale === "en" ? p.nameEn : p.nameIt}</h2>
                    {!p.active && <span className="badge bg-slate-200 text-slate-700">{t("inactive")}</span>}
                  </div>
                  {pricing.price == null ? <p className="text-sm text-slate-500">{t("noPrice")}</p> : <PackagePrice pricing={pricing} locale={locale} />}
                </div>
              </div>
              <div className="mt-2">
                <PackageFacts pkg={p} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
