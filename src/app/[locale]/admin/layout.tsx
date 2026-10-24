import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("admin.nav")]);
  if (!user) return redirect({ href: `/accedi?next=${encodeURIComponent("/admin")}`, locale });
  if (user.role !== "ADMIN") return redirect({ href: "/", locale });

  const items = [
    ["/admin", t("requests")],
    ["/admin/disponibilita", t("availability")],
    ["/admin/pacchetti", t("packages")],
    ["/admin/clienti", t("clients")],
    ["/admin/aspetto", t("appearance")],
    ["/admin/impostazioni", t("settings")],
  ] as const;

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 text-sm">
        {items.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
