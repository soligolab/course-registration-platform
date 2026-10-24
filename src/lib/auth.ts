import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseBilling } from "@/lib/billing";
import { PRIVACY_VERSION } from "@/lib/settings";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET mancante o troppo corto (min 16 caratteri)");
  return s;
}

export function hash(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Cookie "secure" solo se la richiesta arriva per l'host pubblico in https di APP_URL.
 * Lo stesso server è raggiungibile anche in http dalla LAN (es. un nome valido solo in LAN): lì un cookie
 * secure verrebbe scartato dal browser e l'accesso non funzionerebbe.
 */
async function secureCookieForRequest(): Promise<boolean> {
  const appUrl = process.env.APP_URL ?? "";
  if (!appUrl.startsWith("https")) return false;
  const host = (await headers()).get("host")?.split(":")[0].toLowerCase();
  try {
    return host === new URL(appUrl).hostname.toLowerCase();
  } catch {
    return true;
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { tokenHash: hash(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookieForRequest(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

/** Per le pagine admin: il layout fa già il redirect, qui si evita solo di esporre dati. */
export async function requireAdminPage(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  return user;
}

export function isProfileComplete(user: User): boolean {
  // se l'informativa cambia versione, va riaccettata; i dati di fatturazione servono per la fattura
  return Boolean(
    user.firstName && user.lastName && user.age && user.phone && user.privacyVersion === PRIVACY_VERSION && parseBilling(user.billingJson),
  );
}
