import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { PackageFacts } from "@/components/PackageFacts";
import { packagePricing } from "@/lib/pricing";
import { PackagePrice } from "@/components/PackagePrice";
import { localizedDetails } from "@/lib/rich-text";
import { getRates } from "@/lib/settings";

/** Pagina di presentazione del corso: descrizione completa e accesso alla prenotazione. */
export default async function CoursePage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const [pkg, locale, t, th, rates] = await Promise.all([
    prisma.package.findUnique({ where: { id: packageId } }),
    getLocale(),
    getTranslations("course"),
    getTranslations("home"),
    getRates(),
  ]);
  if (!pkg || !pkg.active) notFound();
  const en = locale === "en";
  const pricing = packagePricing(pkg, rates);
  const summary = (en ? pkg.descriptionEn : pkg.descriptionIt) || (en ? pkg.descriptionIt : pkg.descriptionEn);
  const details = localizedDetails(pkg, locale);
  const book = (
    <Link href={`/prenota/${pkg.id}`} className="btn-primary px-6">
      {t("book")}
    </Link>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        {t("back")}
      </Link>
      <div className="card mt-3 flex flex-col gap-5 sm:flex-row sm:items-center">
        {pkg.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pkg.imageUrl} alt="" className="h-28 w-28 shrink-0 rounded-[var(--radius)] object-cover shadow-[var(--shadow-card)]" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl">{en ? pkg.nameEn : pkg.nameIt}</h1>
          {summary && <p className="mt-2 whitespace-pre-line text-slate-600">{summary}</p>}
          <div className="mt-3">
            <PackageFacts pkg={pkg} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="sm:text-right sm:[&_p]:justify-end">
            <PackagePrice pricing={pricing} locale={locale} note={th("priceNote")} size="lg" />
          </div>
          {book}
        </div>
      </div>

      {details && (
        <>
          <article className="card rich mt-6" dangerouslySetInnerHTML={{ __html: details }} />
          <div className="mt-6 flex justify-center">{book}</div>
        </>
      )}
    </div>
  );
}
