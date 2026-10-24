import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { getCurrentUser, isProfileComplete } from "@/lib/auth";
import { monthKey } from "@/lib/time";
import { PackageFacts } from "@/components/PackageFacts";
import { formatPrice, packagePrice } from "@/lib/pricing";
import { getRates } from "@/lib/settings";
import { parseTimeWindows } from "@/lib/packages";
import { BookingClient } from "./BookingClient";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{ invia?: string }>;
}) {
  const [{ packageId }, { invia }] = await Promise.all([params, searchParams]);
  const [pkg, user, locale, t, th, rates] = await Promise.all([
    prisma.package.findUnique({ where: { id: packageId } }),
    getCurrentUser(),
    getLocale(),
    getTranslations("booking"),
    getTranslations("home"),
    getRates(),
  ]);
  if (!pkg || !pkg.active) notFound();
  const price = packagePrice(pkg, rates);

  return (
    <div>
      <div className="flex justify-between gap-4 text-sm">
        <Link href="/" className="text-brand-600 hover:underline">
          {t("back")}
        </Link>
        <Link href={`/corso/${pkg.id}`} className="text-brand-600 hover:underline">
          {t("details")}
        </Link>
      </div>
      <div className="mt-3 mb-6 flex items-start gap-4">
        {pkg.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pkg.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-[var(--radius)] object-cover shadow-[var(--shadow-card)]" />
        )}
        <div>
          <h1 className="text-2xl">{locale === "en" ? pkg.nameEn : pkg.nameIt}</h1>
          {price != null && (
            <p className="mt-1">
              <span className="text-xl font-semibold text-brand-700">{formatPrice(price, locale)}</span>{" "}
              <span className="text-xs text-slate-500">{th("priceNote")}</span>
            </p>
          )}
          <div className="mt-2">
            <PackageFacts pkg={pkg} />
          </div>
        </div>
      </div>
      <BookingClient
        pkg={{
          id: pkg.id,
          totalSlots: pkg.totalSlots,
          minLessonSlots: pkg.minLessonSlots,
          maxLessonSlots: pkg.maxLessonSlots,
          lessonStepSlots: pkg.lessonStepSlots,
          validityDays: pkg.validityDays,
          maxLessonsPerWeek: pkg.maxLessonsPerWeek,
          timeWindows: parseTimeWindows(pkg.timeWindowsJson),
          maxParticipants: pkg.maxParticipants,
        }}
        initialMonth={monthKey(new Date())}
        loggedIn={Boolean(user)}
        profileComplete={Boolean(user && isProfileComplete(user))}
        autoSubmit={invia === "1"}
      />
    </div>
  );
}
