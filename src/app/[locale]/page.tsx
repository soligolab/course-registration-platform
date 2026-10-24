import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { formatDuration, formatPrice, packagePricing } from "@/lib/pricing";
import { PackagePrice } from "@/components/PackagePrice";
import { getRates, getRatesPage } from "@/lib/settings";
import { localizedDetails } from "@/lib/rich-text";
import { singleLessonPackageIds } from "@/lib/single-lessons";
import { COLUMNS_CLASS } from "@/lib/theme";
import { getTheme } from "@/lib/theme-server";
import { Hero } from "@/components/Hero";
import { PackageCard } from "@/components/PackageCard";
import { PackageFacts } from "@/components/PackageFacts";

export default async function HomePage() {
  const [t, locale, packages, theme, rates, ratesPage] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    prisma.package.findMany({ where: { active: true, kind: "PACKAGE" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    getTheme(),
    getRates(),
    getRatesPage(),
  ]);
  const singles = await singleLessonPackageIds();
  const en = locale === "en";
  const pricedRates = rates.filter((r) => r.priceCents != null);
  const ratesDetails = localizedDetails(ratesPage, locale);

  return (
    <div>
      {theme.heroEnabled ? (
        <Hero
          theme={theme}
          title={(en ? theme.heroTitleEn : theme.heroTitleIt) || t("title")}
          subtitle={(en ? theme.heroSubtitleEn : theme.heroSubtitleIt) || t("subtitle")}
          cta={en ? theme.heroCtaEn : theme.heroCtaIt}
        />
      ) : (
        <>
          <h1 className="text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t("subtitle")}</p>
        </>
      )}

      <section id="pacchetti" className="scroll-mt-24 pt-10">
        {theme.heroEnabled && <h2 className="mb-6 text-2xl">{t("packagesTitle")}</h2>}
        {packages.length === 0 ? (
          <p className="text-slate-500">{t("noPackages")}</p>
        ) : (
          <div className={`grid gap-6 sm:grid-cols-2 ${COLUMNS_CLASS[theme.pkgColumns]}`}>
            {packages.map((p) => {
              return (
                <PackageCard
                  key={p.id}
                  theme={theme}
                  name={en ? p.nameEn : p.nameIt}
                  description={en ? p.descriptionEn : p.descriptionIt}
                  imageUrl={p.imageUrl}
                  price={<PackagePrice pricing={packagePricing(p, rates)} locale={locale} note={t("priceNote")} />}
                  facts={<PackageFacts pkg={p} />}
                  action={
                    <div className="grid w-full grid-cols-2 gap-2">
                      <Link href={`/corso/${p.id}`} className="btn-secondary">
                        {t("explore")}
                      </Link>
                      <Link href={`/prenota/${p.id}`} className="btn-primary">
                        {t("choose")}
                      </Link>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {theme.showRates && pricedRates.length > 0 && (
        <section id="tariffe" className="scroll-mt-24 pt-12">
          <h2 className="text-2xl">{(en ? ratesPage.titleEn : ratesPage.titleIt) || t("ratesTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{(en ? ratesPage.subtitleEn : ratesPage.subtitleIt) || t("ratesSubtitle")}</p>
          {ratesDetails && <article className="card rich mt-5" dangerouslySetInnerHTML={{ __html: ratesDetails }} />}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {pricedRates.map((r) => {
              const label = (en ? r.labelEn || r.labelIt : r.labelIt || r.labelEn) || t("rateLesson", { duration: formatDuration(r.minutes) });
              const text = en ? r.textEn || r.textIt : r.textIt || r.textEn;
              return (
                <div key={r.minutes} className="card flex flex-col text-center">
                  <p className="text-sm uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-brand-700">{formatPrice(r.priceCents!, locale)}</p>
                  {text && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{text}</p>}
                  {singles.has(r.minutes) && (
                    <Link href={`/prenota/${singles.get(r.minutes)}`} className="btn-primary mt-4 w-full">
                      {t("bookSingle")}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
