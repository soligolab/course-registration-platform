import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AdminsManager } from "./AdminsManager";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const me = await requireAdminPage();
  const [t, ta, settings, admins] = await Promise.all([
    getTranslations("admin.settings"),
    getTranslations("admin.admins"),
    getSettings(),
    prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="card mt-6">
        <SettingsForm settings={settings} />
      </div>
      <h2 className="mt-10 text-xl font-bold">{ta("title")}</h2>
      <div className="card mt-4">
        <AdminsManager
          currentId={me.id}
          admins={admins.map((a) => ({
            id: a.id,
            email: a.email,
            name: `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(),
            pending: !a.emailVerifiedAt,
          }))}
        />
      </div>
    </div>
  );
}
