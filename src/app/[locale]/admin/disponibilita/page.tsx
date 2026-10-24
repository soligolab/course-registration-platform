import { getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { monthKey } from "@/lib/time";
import { AvailabilityEditor } from "./AvailabilityEditor";

export default async function AvailabilityPage() {
  await requireAdminPage();
  const [t, settings] = await Promise.all([getTranslations("admin.availability"), getSettings()]);
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("help")}</p>
      <div className="mt-6">
        <AvailabilityEditor initialMonth={monthKey(new Date())} dayStart={settings.dayStart} dayEnd={settings.dayEnd} />
      </div>
    </div>
  );
}
