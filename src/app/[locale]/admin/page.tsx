import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/pricing";
import { LessonList } from "@/components/LessonList";
import { fixedLessonSlots } from "@/lib/booking/validate";
import { StatusBadge } from "@/components/StatusBadge";

const STATUSES = ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"] as const;

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPage();
  const { status: raw } = await searchParams;
  const status = STATUSES.find((s) => s === raw);
  const filter = raw === "all" ? undefined : (status ?? "PENDING");
  const [t, ts, locale, requests, counts] = await Promise.all([
    getTranslations("admin.requests"),
    getTranslations("status"),
    getLocale(),
    prisma.bookingRequest.findMany({
      where: filter ? { status: filter } : {},
      include: { user: true, package: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.bookingRequest.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            className={`rounded-full px-3 py-1 ${filter === s ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-300"}`}
          >
            {ts(s)} ({count(s)})
          </Link>
        ))}
        <Link
          href="/admin?status=all"
          className={`rounded-full px-3 py-1 ${!filter ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-300"}`}
        >
          {t("all")}
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="mt-6 text-slate-500">{t("empty")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">{t("client")}</th>
                <th className="p-3">{t("package")}</th>
                <th className="p-3">{t("lessons")}</th>
                <th className="p-3">{t("created")}</th>
                <th className="p-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/admin/richieste/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.user.firstName} {r.user.lastName}
                    </Link>
                    <div className="text-xs text-slate-500">{r.user.email}</div>
                    <div className="text-xs text-slate-500">{r.user.phone}</div>
                  </td>
                  <td className="p-3">
                    {locale === "en" ? r.package.nameEn : r.package.nameIt}
                    {r.priceCents != null && <div className="text-xs text-slate-500">{formatPrice(r.priceCents, locale)}</div>}
                  </td>
                  <td className="p-3">
                    <LessonList slots={JSON.parse(r.slotsJson)} locale={locale} size={fixedLessonSlots(r.package)} />
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(r.createdAt, locale)}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
