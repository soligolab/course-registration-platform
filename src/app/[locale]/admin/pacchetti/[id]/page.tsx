import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getRates, getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { PackageForm } from "./PackageForm";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [t, rates, locale] = await Promise.all([getTranslations("admin.packages"), getRates(), getLocale()]);
  const [pkg, groups, settings] = await Promise.all([
    id === "nuovo" ? null : prisma.package.findUnique({ where: { id } }),
    prisma.package.findMany({ where: { groupKey: { not: "" } }, distinct: ["groupKey"], select: { groupKey: true } }),
    getSettings(),
  ]);
  if (id !== "nuovo" && !pkg) notFound();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">{pkg ? t("edit") : t("new")}</h1>
      <div className="card mt-6">
        <PackageForm pkg={pkg} rates={rates} locale={locale} groups={groups.map((g) => g.groupKey)} dayRange={[settings.dayStart, settings.dayEnd]} />
      </div>
    </div>
  );
}
