import { useTranslations } from "next-intl";
import type { Package } from "@prisma/client";
import { formatDuration, packageLessons } from "@/lib/pricing";
import { SLOT_MINUTES } from "@/lib/time";

export function PackageFacts({
  pkg,
}: {
  pkg: Pick<Package, "totalSlots" | "minLessonSlots" | "maxLessonSlots" | "lessonStepSlots" | "validityDays" | "maxLessonsPerWeek"> &
    Partial<Pick<Package, "maxParticipants">>;
}) {
  const t = useTranslations("pkg");
  const fixed = packageLessons(pkg);
  const min = pkg.minLessonSlots * SLOT_MINUTES;
  const max = pkg.maxLessonSlots * SLOT_MINUTES;
  return (
    <ul className="space-y-1 text-sm text-slate-600">
      {fixed && <li className="font-medium text-slate-800">{t("lessons", { n: fixed.count, duration: formatDuration(fixed.minutes) })}</li>}
      {fixed?.count !== 1 && <li>{t("hours", { hours: (pkg.totalSlots * SLOT_MINUTES) / 60 })}</li>}
      {!fixed && <li>{t("lesson", { min, max })}</li>}
      {!fixed && pkg.lessonStepSlots > 1 && <li>{t("step", { step: pkg.lessonStepSlots * SLOT_MINUTES })}</li>}
      {fixed?.count !== 1 && <li>{t("validity", { days: pkg.validityDays })}</li>}
      {pkg.maxLessonsPerWeek != null && <li>{t("perWeek", { n: pkg.maxLessonsPerWeek })}</li>}
      {(pkg.maxParticipants ?? 1) > 1 && <li>{t("participants", { n: pkg.maxParticipants! })}</li>}
    </ul>
  );
}
