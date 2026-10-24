"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { billingSchema } from "@/lib/billing";
import { prisma } from "@/lib/db";
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  createSession,
  destroySession,
  generateOtp,
  getCurrentUser,
  hash,
  normalizeEmail,
} from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mail";
import { PRIVACY_VERSION } from "@/lib/settings";

const RATE_WINDOW_MS = 15 * 60_000;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function requestOtp(rawEmail: string, locale: string): Promise<Result> {
  const parsed = z.string().email().max(200).safeParse(normalizeEmail(rawEmail));
  if (!parsed.success) return { ok: false, error: "INVALID_EMAIL" };
  const email = parsed.data;
  const ip = await clientIp();
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.otpCode.count({ where: { email, createdAt: { gte: since } } }),
    prisma.otpCode.count({ where: { ip, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) return { ok: false, error: "RATE_LIMIT" };

  const code = generateOtp();
  await prisma.otpCode.create({
    data: { email, ip, codeHash: hash(`${email}:${code}`), expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) },
  });
  await sendOtpEmail(email, code, locale, OTP_TTL_MINUTES);
  return { ok: true };
}

export async function verifyOtp(
  rawEmail: string,
  rawCode: string,
  locale: string,
): Promise<Result<{ isAdmin: boolean }>> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  const otp = await prisma.otpCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { ok: false, error: "CODE_EXPIRED" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "TOO_MANY_ATTEMPTS" };
  if (otp.codeHash !== hash(`${email}:${code}`)) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "INVALID_CODE" };
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const adminEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : null;
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    const noAdmin = (await tx.user.count({ where: { role: "ADMIN" } })) === 0;
    // Bootstrap admin: il primo utente (o ADMIN_EMAIL, se impostato) diventa amministratore.
    const becomesAdmin = noAdmin && (adminEmail ? email === adminEmail : (await tx.user.count()) === 0);
    if (existing) {
      return tx.user.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date(), ...(becomesAdmin ? { role: "ADMIN" } : {}) },
      });
    }
    return tx.user.create({
      data: { email, locale, emailVerifiedAt: new Date(), role: becomesAdmin ? "ADMIN" : "CLIENT" },
    });
  });

  await createSession(user.id);
  return { ok: true, isAdmin: user.role === "ADMIN" };
}

export async function logout() {
  await destroySession();
}

const profileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    age: z.coerce.number().int().min(3).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{6,20}$/),
    privacy: z.literal("on"),
    guardianName: z.string().trim().max(160).optional(),
    guardianConsent: z.string().optional(),
    locale: z.enum(["it", "en"]),
  })
  .refine((v) => v.age >= 14 || (v.guardianName && v.guardianConsent === "on"), { path: ["guardianName"] });

export type ProfileState = { ok?: boolean; errors?: string[] };

export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { errors: ["UNAUTHENTICATED"] };
  const entries = Object.fromEntries(form);
  const parsed = profileSchema.safeParse(entries);
  // i campi di fatturazione arrivano con prefisso "b_"; gli errori tornano con lo stesso prefisso
  const billingRaw = Object.fromEntries(Object.entries(entries).filter(([k]) => k.startsWith("b_")).map(([k, v]) => [k.slice(2), v]));
  const billing = billingSchema.safeParse(billingRaw);
  const errors = [
    ...(parsed.success ? [] : parsed.error.issues.map((i) => String(i.path[0]))),
    ...(billing.success ? [] : billing.error.issues.map((i) => `b_${String(i.path[0])}`)),
  ];
  if (!parsed.success || !billing.success) return { errors: [...new Set(errors)] };
  const v = parsed.data;
  const minor = v.age < 14;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: v.firstName,
      lastName: v.lastName,
      age: v.age,
      phone: v.phone,
      locale: v.locale,
      guardianName: minor ? v.guardianName : null,
      guardianConsentAt: minor ? new Date() : null,
      billingJson: JSON.stringify(billing.data),
      // la data di accettazione si aggiorna solo se cambia la versione dell'informativa
      ...(user.privacyVersion !== PRIVACY_VERSION || !user.privacyAcceptedAt
        ? { privacyAcceptedAt: new Date(), privacyVersion: PRIVACY_VERSION }
        : {}),
    },
  });
  return { ok: true };
}
