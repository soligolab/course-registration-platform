"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeEmail, requireAdmin } from "@/lib/auth";
import { sendStatusEmail } from "@/lib/mail";
import { ratesSchema, type Rate } from "@/lib/pricing";
import { MAX_DETAILS_LENGTH, sanitizeRichHtml } from "@/lib/rich-text";
import { getRates, getSettings, saveRates, saveSettings, SETTING_DEFAULTS, type Settings } from "@/lib/settings";
import { themeSchema, type Theme } from "@/lib/theme";
import { saveTheme } from "@/lib/theme-server";
import { SLOT_MINUTES, addMonths, daysInMonth, monthKey, monthRange, slotsForDay, weekdayIndex, zonedInstant } from "@/lib/time";

/* ---------- Disponibilità ---------- */

export type AdminMonth = {
  available: string[];
  booked: { startAt: string; requestId: string; name: string; status: string }[];
};

export async function getAdminMonth(month: string): Promise<AdminMonth> {
  await requireAdmin();
  const { start, end } = monthRange(month);
  const [available, booked] = await Promise.all([
    prisma.availabilitySlot.findMany({ where: { startAt: { gte: start, lt: end } } }),
    prisma.bookedSlot.findMany({
      where: { startAt: { gte: start, lt: end } },
      include: { request: { include: { user: true } } },
    }),
  ]);
  return {
    available: available.map((a) => a.startAt.toISOString()),
    booked: booked.map((b) => ({
      startAt: b.startAt.toISOString(),
      requestId: b.requestId,
      name: `${b.request.user.firstName ?? ""} ${b.request.user.lastName ?? ""}`.trim() || b.request.user.email,
      status: b.request.status,
    })),
  };
}

/** Imposta la disponibilità di un giorno agli orari locali "HH:mm" indicati. */
async function setDayTimes(day: string, times: string[], settings: Settings) {
  const grid = slotsForDay(day, settings.dayStart, settings.dayEnd);
  const wanted = new Set(times.map((t) => zonedInstant(day, t).toISOString()).filter((s) => grid.includes(s)));
  const start = zonedInstant(day, "00:00");
  const end = new Date(start.getTime() + 36 * 3_600_000); // copre i giorni da 23/25 ore
  const existing = await prisma.availabilitySlot.findMany({ where: { startAt: { gte: start, lt: end } } });
  const existingDay = existing.filter((e) => grid.includes(e.startAt.toISOString()));
  const have = new Set(existingDay.map((e) => e.startAt.toISOString()));
  const removable = existingDay.filter((e) => !wanted.has(e.startAt.toISOString())).map((e) => e.startAt);
  // gli slot prenotati restano disponibili: si tolgono solo quelli liberi
  const booked = removable.length
    ? await prisma.bookedSlot.findMany({ where: { startAt: { in: removable } }, select: { startAt: true } })
    : [];
  const bookedSet = new Set(booked.map((b) => b.startAt.getTime()));
  const toDelete = removable.filter((d) => !bookedSet.has(d.getTime()));
  const toCreate = [...wanted].filter((s) => !have.has(s));
  await prisma.$transaction([
    prisma.availabilitySlot.deleteMany({ where: { startAt: { in: toDelete } } }),
    prisma.availabilitySlot.createMany({ data: toCreate.map((s) => ({ startAt: new Date(s) })) }),
  ]);
}

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timesSchema = z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(48);

export async function setDayAvailability(day: string, times: string[]) {
  await requireAdmin();
  await setDayTimes(daySchema.parse(day), timesSchema.parse(times), await getSettings());
}

/** Copia gli orari di `day` su tutti gli stessi giorni della settimana successivi, per `months` mesi. */
export async function applyToSameWeekday(day: string, times: string[], months: number) {
  await requireAdmin();
  daySchema.parse(day);
  timesSchema.parse(times);
  const settings = await getSettings();
  const wd = weekdayIndex(day);
  const first = monthKey(zonedInstant(day, "12:00"));
  const targets = Array.from({ length: Math.min(Math.max(months, 1), 12) }, (_, i) => addMonths(first, i))
    .flatMap(daysInMonth)
    .filter((d) => d >= day && weekdayIndex(d) === wd);
  for (const d of targets) await setDayTimes(d, times, settings);
  return targets.length;
}

/* ---------- Pacchetti ---------- */

// Ogni pacchetto ha una durata di lezione fissa, scelta tra quelle del tariffario.
const packageSchema = z.object({
  id: z.string().optional(),
  nameIt: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionIt: z.string().max(2000).default(""),
  descriptionEn: z.string().max(2000).default(""),
  detailsIt: z.string().max(MAX_DETAILS_LENGTH).default(""),
  detailsEn: z.string().max(MAX_DETAILS_LENGTH).default(""),
  lessonsCount: z.coerce.number().int().min(1).max(200),
  lessonMinutes: z.coerce.number().int().min(SLOT_MINUTES).max(480).refine((m) => m % SLOT_MINUTES === 0),
  validityDays: z.coerce.number().int().min(1).max(730),
  maxLessonsPerWeek: z.union([z.literal(""), z.coerce.number().int().min(1).max(14)]).optional(),
  sortOrder: z.coerce.number().int().default(0),
  active: z.string().optional(),
  imageUrl: themeSchema.shape.logoUrl.default(""),
});

export type FormState = { ok?: boolean; errors?: string[] };

export async function savePackage(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = packageSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const v = parsed.data;
  if (!(await getRates()).some((r) => r.minutes === v.lessonMinutes)) return { errors: ["lessonMinutes"] };
  const lessonSlots = v.lessonMinutes / SLOT_MINUTES;
  const data = {
    nameIt: v.nameIt,
    nameEn: v.nameEn,
    descriptionIt: v.descriptionIt,
    descriptionEn: v.descriptionEn,
    detailsIt: sanitizeRichHtml(v.detailsIt),
    detailsEn: sanitizeRichHtml(v.detailsEn),
    totalSlots: v.lessonsCount * lessonSlots,
    minLessonSlots: lessonSlots,
    maxLessonSlots: lessonSlots,
    lessonStepSlots: lessonSlots,
    validityDays: v.validityDays,
    maxLessonsPerWeek: v.maxLessonsPerWeek === "" || v.maxLessonsPerWeek == null ? null : v.maxLessonsPerWeek,
    sortOrder: v.sortOrder,
    active: v.active === "on",
    imageUrl: v.imageUrl,
  };
  if (v.id) await prisma.package.update({ where: { id: v.id }, data });
  else await prisma.package.create({ data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePackage(id: string): Promise<{ ok: boolean; deactivated?: boolean }> {
  await requireAdmin();
  const used = await prisma.bookingRequest.count({ where: { packageId: id } });
  if (used > 0) {
    await prisma.package.update({ where: { id }, data: { active: false } });
    revalidatePath("/", "layout");
    return { ok: true, deactivated: true };
  }
  await prisma.package.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Richieste ---------- */

const statusSchema = z.enum(["CONFIRMED", "REJECTED", "CANCELLED"]);
const ALLOWED: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
};

export async function updateRequestStatus(
  id: string,
  rawStatus: string,
  notify: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const status = statusSchema.parse(rawStatus);
  const req = await prisma.bookingRequest.findUnique({ where: { id }, include: { user: true, package: true } });
  if (!req) return { ok: false, error: "NOT_FOUND" };
  if (!ALLOWED[req.status]?.includes(status)) return { ok: false, error: "INVALID_TRANSITION" };

  await prisma.$transaction([
    prisma.bookingRequest.update({ where: { id }, data: { status } }),
    // rifiuto/annullamento liberano gli slot
    ...(status === "CONFIRMED" ? [] : [prisma.bookedSlot.deleteMany({ where: { requestId: id } })]),
  ]);

  if (notify) {
    try {
      await sendStatusEmail(req.user, req.package, status);
    } catch (e) {
      console.error("Invio email stato fallito", e);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveAdminNotes(id: string, notes: string) {
  await requireAdmin();
  await prisma.bookingRequest.update({ where: { id }, data: { adminNotes: z.string().max(5000).parse(notes) } });
  revalidatePath("/", "layout");
}

/* ---------- Clienti ---------- */

export async function deleteClient(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (admin.id === id) return { ok: false, error: "SELF" };
  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, error: e.code };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Amministratori ---------- */

/** Nomina amministratore un utente esistente o crea l'utente: al primo accesso con OTP entra già come admin. */
export async function addAdmin(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z.string().trim().email().safeParse(form.get("email"));
  if (!parsed.success) return { errors: ["email"] };
  const email = normalizeEmail(parsed.data);
  await prisma.user.upsert({ where: { email }, create: { email, role: "ADMIN" }, update: { role: "ADMIN" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Riporta un admin a cliente. Non ci si può togliere da soli, quindi resta sempre almeno un admin. */
export async function removeAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  if (admin.id === id) return { ok: false, error: "SELF" };
  await prisma.user.update({ where: { id }, data: { role: "CLIENT" } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Tariffario ---------- */

export async function saveRatesAction(rates: Rate[]): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = ratesSchema.safeParse(rates);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "DUPLICATE") ? "DUPLICATE" : "INVALID" };
  // una durata usata da un pacchetto non si può togliere: il pacchetto resterebbe senza prezzo
  const used = await prisma.package.findMany({ select: { minLessonSlots: true, maxLessonSlots: true } });
  const kept = new Set(parsed.data.map((r) => r.minutes));
  if (used.some((p) => p.minLessonSlots === p.maxLessonSlots && !kept.has(p.minLessonSlots * SLOT_MINUTES))) {
    return { ok: false, error: "IN_USE" };
  }
  await saveRates([...parsed.data].sort((a, b) => a.minutes - b.minutes));
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Aspetto ---------- */

export async function saveThemeAction(theme: Theme): Promise<{ ok: boolean; errors?: string[] }> {
  await requireAdmin();
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  await saveTheme(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- Impostazioni ---------- */

const settingsSchema = z.object({
  businessName: z.string().trim().max(120),
  ownerName: z.string().trim().max(200),
  ownerContact: z.string().trim().max(300),
  adminNotifyEmail: z.union([z.literal(""), z.string().trim().email()]),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 60).transform(String),
  dayStart: z.string().regex(/^\d{2}:(00|15|30|45)$/),
  dayEnd: z.string().regex(/^\d{2}:(00|15|30|45)$/),
});

export async function saveSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = Object.fromEntries(Object.keys(SETTING_DEFAULTS).map((k) => [k, form.get(k) ?? ""]));
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  if (parsed.data.dayStart >= parsed.data.dayEnd) return { errors: ["dayEnd"] };
  await saveSettings(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
