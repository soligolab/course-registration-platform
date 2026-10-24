import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getTheme } from "@/lib/theme-server";
import { ThemeEditor } from "./ThemeEditor";

export default async function AppearancePage() {
  await requireAdminPage();
  const [t, theme, settings] = await Promise.all([getTranslations("admin.theme"), getTheme(), getSettings()]);
  return (
    <div>
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 max-w-3xl text-sm text-slate-600">{t("intro")}</p>
      <ThemeEditor initial={theme} businessName={settings.businessName} />
    </div>
  );
}
