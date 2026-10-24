import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Link, routing, type AppLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fontVariables } from "@/lib/fonts";
import { WIDTH_CLASS, themeCss } from "@/lib/theme";
import { getTheme } from "@/lib/theme-server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import "../globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: s.businessName };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as AppLocale)) notFound();

  const [messages, t, user, settings, theme] = await Promise.all([
    getMessages(),
    getTranslations("nav"),
    getCurrentUser(),
    getSettings(),
    getTheme(),
  ]);
  const width = WIDTH_CLASS[theme.width];
  const footerText = locale === "en" ? theme.footerTextEn : theme.footerTextIt;

  return (
    <html lang={locale} className={fontVariables}>
      <head>
        {/* il tema arriva dal DB (valori già validati da zod): nessun input libero finisce qui */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body className="flex min-h-screen flex-col text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          <header
            className={`z-30 border-b border-black/5 bg-[rgb(var(--header-bg))] text-[rgb(var(--header-text))] ${theme.headerSticky ? "sticky top-0" : ""} ${theme.headerShadow ? "shadow-[var(--shadow-card)]" : ""}`}
          >
            <nav className={`mx-auto flex ${width} flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm`}>
              <Link href="/" className="mr-auto flex items-center gap-3 text-lg font-semibold [font-family:var(--font-heading)]">
                {theme.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={theme.logoUrl} alt={theme.showName ? "" : settings.businessName} style={{ height: theme.logoHeight }} className="w-auto" />
                )}
                {(theme.showName || !theme.logoUrl) && settings.businessName}
              </Link>
              <Link href="/" className="opacity-85 hover:opacity-100">
                {t("packages")}
              </Link>
              {user && (
                <Link href="/le-mie-richieste" className="opacity-85 hover:opacity-100">
                  {t("myRequests")}
                </Link>
              )}
              {user?.role === "ADMIN" && (
                <Link href="/admin" className="font-semibold underline-offset-4 hover:underline">
                  {t("admin")}
                </Link>
              )}
              {user ? (
                <>
                  <Link href="/profilo" className="opacity-85 hover:opacity-100">
                    {t("profile")}
                  </Link>
                  <LogoutButton label={t("logout")} />
                </>
              ) : (
                <Link href="/accedi" className="btn-secondary py-1.5">
                  {t("login")}
                </Link>
              )}
              <LocaleSwitcher />
            </nav>
          </header>
          <main className={`mx-auto w-full ${width} flex-1 px-4 py-8`}>{children}</main>
          <footer className="bg-[rgb(var(--footer-bg))] text-[rgb(var(--footer-text))]">
            <div className={`mx-auto ${width} space-y-1 px-4 py-6 text-xs`}>
              {footerText && <p className="whitespace-pre-line text-sm opacity-90">{footerText}</p>}
              <p className="opacity-80">
                © {new Date().getFullYear()} {settings.businessName} ·{" "}
                <Link href="/privacy" className="underline hover:opacity-100">
                  {t("privacy")}
                </Link>
              </p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
