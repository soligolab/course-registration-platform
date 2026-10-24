import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEFAULT_RATES, parseRates, type Rate } from "@/lib/pricing";

export const PRIVACY_VERSION = "2026-10-24"; // aggiunti i dati di fatturazione

export const SETTING_DEFAULTS = {
  businessName: "Corsi",
  ownerName: "",
  ownerContact: "",
  adminNotifyEmail: "",
  minNoticeHours: "24",
  dayStart: "07:00",
  dayEnd: "22:00",
};

export type Settings = typeof SETTING_DEFAULTS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const s = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in s) s[r.key as SettingKey] = r.value;
  return s;
}

export async function saveSettings(values: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } }),
    ),
  );
}

/** Email a cui inviare le notifiche: tutti gli admin, più l'eventuale indirizzo aggiuntivo delle impostazioni. */
export async function adminNotifyEmails(settings: Settings): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const emails = admins.map((a) => a.email);
  if (settings.adminNotifyEmail) emails.push(settings.adminNotifyEmail.trim().toLowerCase());
  return [...new Set(emails)];
}

/** Tariffario (chiave "rates", JSON). Vedi src/lib/pricing.ts. */
export async function getRates(): Promise<Rate[]> {
  const row = await prisma.setting.findUnique({ where: { key: "rates" } });
  if (!row) return DEFAULT_RATES;
  try {
    return parseRates(JSON.parse(row.value));
  } catch {
    return DEFAULT_RATES;
  }
}

export async function saveRates(rates: Rate[]) {
  const value = JSON.stringify(rates);
  await prisma.setting.upsert({ where: { key: "rates" }, create: { key: "rates", value }, update: { value } });
}

/* Sezione Tariffe della home (chiave "ratesPage", JSON): testi e descrizione ricca; vuoto = testi predefiniti. */
export const ratesPageSchema = z.object({
  titleIt: z.string().trim().max(120).default(""),
  titleEn: z.string().trim().max(120).default(""),
  subtitleIt: z.string().trim().max(300).default(""),
  subtitleEn: z.string().trim().max(300).default(""),
  detailsIt: z.string().max(100_000).default(""),
  detailsEn: z.string().max(100_000).default(""),
});
export type RatesPage = z.infer<typeof ratesPageSchema>;

export async function getRatesPage(): Promise<RatesPage> {
  const row = await prisma.setting.findUnique({ where: { key: "ratesPage" } });
  try {
    return ratesPageSchema.parse(row ? JSON.parse(row.value) : {});
  } catch {
    return ratesPageSchema.parse({});
  }
}

export async function saveRatesPage(page: RatesPage) {
  const value = JSON.stringify(page);
  await prisma.setting.upsert({ where: { key: "ratesPage" }, create: { key: "ratesPage", value }, update: { value } });
}
