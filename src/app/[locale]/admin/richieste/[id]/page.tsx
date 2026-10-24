import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/pricing";
import { billingLines, parseBilling } from "@/lib/billing";
import { CopyButton } from "@/components/CopyButton";
import { LessonList } from "@/components/LessonList";
import { StatusBadge } from "@/components/StatusBadge";
import { RequestActions } from "./RequestActions";

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [req, t, locale] = await Promise.all([
    prisma.bookingRequest.findUnique({ where: { id }, include: { user: true, package: true } }),
    getTranslations("admin.requests"),
    getLocale(),
  ]);
  if (!req) notFound();
  const u = req.user;
  // la copia salvata con la richiesta; per richieste precedenti alla funzione, i dati attuali
  const billing = parseBilling(req.billingJson) ?? parseBilling(u.billingJson);
  const lines = billing ? billingLines(billing, { taxCode: t("taxCode"), vat: t("vat"), sdi: t("sdi"), pec: "PEC" }) : [];

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">
        {t("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("detail")}</h1>
        <StatusBadge status={req.status} />
      </div>
      <p className="text-sm text-slate-500">{formatDateTime(req.createdAt, locale)}</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card space-y-1 text-sm">
          <h2 className="mb-2 font-semibold">{t("contact")}</h2>
          <p className="text-base font-medium">
            {u.firstName} {u.lastName}
          </p>
          {u.age != null && <p>{t("age", { age: u.age })}</p>}
          <p>
            <a className="text-brand-600 hover:underline" href={`mailto:${u.email}`}>
              {u.email}
            </a>
          </p>
          <p>
            <a className="text-brand-600 hover:underline" href={`tel:${u.phone}`}>
              {u.phone}
            </a>
          </p>
          {u.guardianName && <p>{t("guardian", { name: u.guardianName })}</p>}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">{locale === "en" ? req.package.nameEn : req.package.nameIt}</h2>
          <LessonList slots={JSON.parse(req.slotsJson)} locale={locale} />
          {req.priceCents != null && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm">
              {t("price")}: <span className="font-semibold">{formatPrice(req.priceCents, locale)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="card mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {t("billing")}
            {billing && <span className="ml-2 badge bg-slate-100 text-slate-600">{t(billing.type === "BUSINESS" ? "billingBusiness" : "billingPrivate")}</span>}
          </h2>
          {billing && <CopyButton text={lines.join("\n")} label={t("copy")} done={t("copied")} />}
        </div>
        {billing ? (
          <div className="text-sm leading-relaxed">
            {lines.map((l, i) => (
              <div key={i} className={i === 0 ? "font-medium" : ""}>
                {l}
              </div>
            ))}
            {billing.type === "BUSINESS" && billing.country === "IT" && !billing.sdiCode && !billing.pec && (
              <p className="mt-2 text-xs text-slate-500">{t("noSdi")}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("noBilling")}</p>
        )}
      </div>

      {req.userNotes && (
        <div className="card mt-5">
          <h2 className="mb-2 font-semibold">{t("userNotes")}</h2>
          <p className="whitespace-pre-line text-sm">{req.userNotes}</p>
        </div>
      )}

      <RequestActions id={req.id} status={req.status} adminNotes={req.adminNotes} />
    </div>
  );
}
