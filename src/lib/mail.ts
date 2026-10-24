import "server-only";
import nodemailer from "nodemailer";
import type { BookingRequest, Package, User } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { fixedLessonSlots, groupLessons } from "@/lib/booking/validate";
import { billingLines, parseBilling } from "@/lib/billing";
import { formatPrice } from "@/lib/pricing";
import { SLOT_MS, TZ } from "@/lib/time";

type Locale = "it" | "en";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

async function send(to: string | string[], subject: string, text: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n--- EMAIL (SMTP non configurato) ---\nTo: ${[to].flat().join(", ")}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM ?? "noreply@example.com", to, subject, text });
}

function esc(s: string) {
  return s.replace(/[\r\n]+/g, " ");
}

/** Elenco leggibile delle lezioni, es. "lun 02/11/2026 10:00–12:00". */
export function formatLessons(slotsIso: string[], locale: Locale, size?: number): string {
  const dateFmt = locale === "it" ? "EEE dd/MM/yyyy HH:mm" : "EEE yyyy-MM-dd HH:mm";
  return groupLessons(slotsIso, size)
    .map((l) => {
      const end = new Date(Date.parse(l.slots[l.slots.length - 1]) + SLOT_MS);
      return `- ${formatInTimeZone(new Date(l.start), TZ, dateFmt)}–${formatInTimeZone(end, TZ, "HH:mm")}`;
    })
    .join("\n");
}

const T = {
  it: {
    otpSubject: (code: string) => `Il tuo codice di verifica: ${code}`,
    otpBody: (code: string, minutes: number) =>
      `Il tuo codice di verifica è: ${code}\n\nIl codice scade tra ${minutes} minuti. Se non hai richiesto tu questo codice, ignora questa email.`,
    clientSubject: "Abbiamo ricevuto la tua richiesta di prenotazione",
    clientBody: (name: string, pkg: string, lessons: string, price: string | null) =>
      `Ciao ${name},\n\ngrazie per la tua richiesta di prenotazione per il pacchetto "${pkg}".\n\nDate richieste:\n${lessons}\n${price ? `\nTotale indicativo: ${price}\n` : ""}\nVerrai contattato a breve per confermare le date e completare l'ordine.\n\nA presto!`,
    statusSubject: (s: string) => `Aggiornamento sulla tua richiesta: ${s}`,
    statusBody: (name: string, pkg: string, s: string) =>
      `Ciao ${name},\n\nla tua richiesta per il pacchetto "${pkg}" è ora: ${s}.\n\nPer qualsiasi domanda rispondi a questa email.`,
    status: { CONFIRMED: "confermata", REJECTED: "rifiutata", CANCELLED: "annullata", PENDING: "in attesa" },
  },
  en: {
    otpSubject: (code: string) => `Your verification code: ${code}`,
    otpBody: (code: string, minutes: number) =>
      `Your verification code is: ${code}\n\nThe code expires in ${minutes} minutes. If you did not request it, please ignore this email.`,
    clientSubject: "We received your booking request",
    clientBody: (name: string, pkg: string, lessons: string, price: string | null) =>
      `Hi ${name},\n\nthank you for your booking request for the "${pkg}" package.\n\nRequested dates:\n${lessons}\n${price ? `\nIndicative total: ${price}\n` : ""}\nYou will be contacted shortly to confirm the dates and complete your order.\n\nSee you soon!`,
    statusSubject: (s: string) => `Update on your request: ${s}`,
    statusBody: (name: string, pkg: string, s: string) =>
      `Hi ${name},\n\nyour request for the "${pkg}" package is now: ${s}.\n\nReply to this email for any question.`,
    status: { CONFIRMED: "confirmed", REJECTED: "rejected", CANCELLED: "cancelled", PENDING: "pending" },
  },
};

const loc = (l: string): Locale => (l === "en" ? "en" : "it");
const pkgName = (p: Package, l: Locale) => (l === "en" ? p.nameEn : p.nameIt);

export async function sendOtpEmail(to: string, code: string, locale: string, minutes: number) {
  const t = T[loc(locale)];
  await send(to, t.otpSubject(code), t.otpBody(code, minutes));
}

export async function sendBookingEmails(opts: {
  user: User;
  pkg: Package;
  request: BookingRequest;
  slots: string[];
  adminEmails: string[];
}) {
  const { user, pkg, request, slots, adminEmails } = opts;
  const l = loc(user.locale);
  const t = T[l];
  await send(
    user.email,
    t.clientSubject,
    t.clientBody(
      esc(user.firstName ?? ""),
      pkgName(pkg, l),
      formatLessons(slots, l, fixedLessonSlots(pkg)),
      request.priceCents == null ? null : formatPrice(request.priceCents, l),
    ),
  );

  if (adminEmails.length) {
    const base = process.env.APP_URL ?? "";
    const billing = parseBilling(request.billingJson);
    const body = [
      `Nuova richiesta di prenotazione.`,
      ``,
      `Cliente: ${esc(`${user.firstName} ${user.lastName}`)} (${user.age} anni)`,
      `Email: ${user.email}`,
      `Telefono: ${esc(user.phone ?? "")}`,
      user.guardianName ? `Genitore/tutore: ${esc(user.guardianName)}` : null,
      `Pacchetto: ${pkg.nameIt}`,
      ``,
      `Date richieste:`,
      formatLessons(slots, "it", fixedLessonSlots(pkg)),
      request.priceCents == null ? null : `\nTotale indicativo: ${formatPrice(request.priceCents, "it")}`,
      billing ? `\nDati per la fattura:\n${billingLines(billing, { taxCode: "Codice fiscale", vat: "Partita IVA", sdi: "Codice SDI", pec: "PEC" }).join("\n")}` : null,
      request.userNotes ? `\nNote del cliente:\n${request.userNotes}` : null,
      ``,
      `Gestisci la richiesta: ${base}/admin/richieste/${request.id}`,
    ]
      .filter((x) => x !== null)
      .join("\n");
    await send(adminEmails, `Nuova richiesta: ${esc(`${user.firstName} ${user.lastName}`)} – ${pkg.nameIt}`, body);
  }
}

export async function sendStatusEmail(user: User, pkg: Package, status: keyof (typeof T)["it"]["status"]) {
  const l = loc(user.locale);
  const t = T[l];
  const s = t.status[status];
  await send(user.email, t.statusSubject(s), t.statusBody(esc(user.firstName ?? ""), pkgName(pkg, l), s));
}
