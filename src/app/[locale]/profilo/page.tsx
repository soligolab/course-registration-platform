import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { parseBilling } from "@/lib/billing";
import { PRIVACY_VERSION } from "@/lib/settings";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, user, locale, t] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getLocale(),
    getTranslations("profile"),
  ]);
  if (!user) return redirect({ href: `/accedi?next=${encodeURIComponent("/profilo")}`, locale });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("intro")}</p>
      {next && <p className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">{t("fromBooking")}</p>}
      <div className="card mt-6">
        <ProfileForm
          next={next ?? null}
          initial={{
            email: user.email,
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            age: user.age?.toString() ?? "",
            phone: user.phone ?? "",
            guardianName: user.guardianName ?? "",
            privacyAccepted: user.privacyVersion === PRIVACY_VERSION,
            billing: parseBilling(user.billingJson),
          }}
        />
      </div>
    </div>
  );
}
