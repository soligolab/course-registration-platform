import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/pricing";
import { LessonList } from "@/components/LessonList";
import { StatusBadge } from "@/components/StatusBadge";

export default async function MyRequestsPage() {
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("myRequests")]);
  if (!user) return redirect({ href: `/accedi?next=${encodeURIComponent("/le-mie-richieste")}`, locale });

  const requests = await prisma.bookingRequest.findMany({
    where: { userId: user.id },
    include: { package: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {requests.length === 0 ? (
        <p className="mt-6 text-slate-500">{t("empty")}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{locale === "en" ? r.package.nameEn : r.package.nameIt}</h2>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("sentOn", { date: formatDateTime(r.createdAt, locale) })}</p>
              <div className="mt-3">
                <LessonList slots={JSON.parse(r.slotsJson)} locale={locale} />
              </div>
              {r.priceCents != null && (
                <p className="mt-3 text-sm">
                  {t("price")}: <span className="font-semibold">{formatPrice(r.priceCents, locale)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
