import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { formatDuration, formatPrice, packagePrice } from "@/lib/pricing";
import { getRates } from "@/lib/settings";
import { COLUMNS_CLASS } from "@/lib/theme";
import { getTheme } from "@/lib/theme-server";
import { Hero } from "@/components/Hero";
import { PackageCard } from "@/components/PackageCard";
import { PackageFacts } from "@/components/PackageFacts";

export default async function HomePage() {
  const [t, locale, packages, theme, rates] = await Promise.all([
    getTranslations("home"),
    getLocale(),
    prisma.package.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    getTheme(),
    getRates(),
  ]);
  const en = locale === "en";
  const pricedRates = rates.filter((r) => r.priceCents != null);

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
              const price = packagePrice(p, rates);
              return (
                <PackageCard
                  key={p.id}
                  theme={theme}
                  name={en ? p.nameEn : p.nameIt}
                  description={en ? p.descriptionEn : p.descriptionIt}
                  imageUrl={p.imageUrl}
                  price={price == null ? null : formatPrice(price, locale)}
                  priceNote={t("priceNote")}
                  facts={<PackageFacts pkg={p} />}
                  action={
                    <Link href={`/prenota/${p.id}`} className="btn-primary w-full">
                      {t("choose")}
                    </Link>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {theme.showRates && pricedRates.length > 0 && (
        <section id="tariffe" className="scroll-mt-24 pt-12">
          <h2 className="text-2xl">{t("ratesTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("ratesSubtitle")}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {pricedRates.map((r) => (
              <div key={r.minutes} className="card text-center">
                <p className="text-sm uppercase tracking-wide text-slate-500">{t("rateLesson", { duration: formatDuration(r.minutes) })}</p>
                <p className="mt-2 text-3xl font-semibold text-brand-700">{formatPrice(r.priceCents!, locale)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
