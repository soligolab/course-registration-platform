import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { DeleteClientButton } from "./DeleteClientButton";

export default async function ClientsPage() {
  const admin = await requireAdminPage();
  const [t, locale, users] = await Promise.all([
    getTranslations("admin.clients"),
    getLocale(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { requests: true } } } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {users.length === 0 ? (
        <p className="mt-6 text-slate-500">{t("empty")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">{t("name")}</th>
                <th className="p-3">{t("email")}</th>
                <th className="p-3">{t("phone")}</th>
                <th className="p-3">{t("age")}</th>
                <th className="p-3">{t("privacy")}</th>
                <th className="p-3">{t("requests")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">
                    {u.firstName} {u.lastName} {u.role === "ADMIN" && <span className="badge bg-brand-100 text-brand-700">admin</span>}
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.phone}</td>
                  <td className="p-3">{u.age}</td>
                  <td className="p-3 whitespace-nowrap">{u.privacyAcceptedAt ? formatDateTime(u.privacyAcceptedAt, locale) : "—"}</td>
                  <td className="p-3">{u._count.requests}</td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <a className="mr-3 text-brand-600 hover:underline" href={`/api/admin/clients/${u.id}/export`}>
                      {t("export")}
                    </a>
                    {u.id !== admin.id && <DeleteClientButton id={u.id} label={t("delete")} confirmText={t("deleteConfirm")} />}
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
