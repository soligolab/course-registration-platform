"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, isProfileComplete } from "@/lib/auth";
import { freeSlotsBetween, joinableLessons, type JoinableInfo } from "@/lib/availability";
import { inTimeWindows, validateSelection, type ValidationError } from "@/lib/booking/validate";
import { packageRules } from "@/lib/packages";
import { sendBookingEmails } from "@/lib/mail";
import { priceForLessons } from "@/lib/pricing";
import { adminNotifyEmails, getRates, getSettings } from "@/lib/settings";
import { SLOT_MINUTES, SLOT_MS, dayKey, monthRange } from "@/lib/time";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; details?: ValidationError[] };

const inputSchema = z.object({
  packageId: z.string().min(1),
  slots: z.array(z.string().datetime()).min(1).max(500),
  notes: z.string().max(2000).default(""),
});

export type BookableMonth = { free: string[]; joinable: JoinableInfo[] };

/**
 * Cosa si può prenotare in un mese "YYYY-MM" per un pacchetto (pubblico): slot liberi dentro le fasce
 * del pacchetto e lezioni di gruppo già fissate con posti liberi (tolte quelle a cui il cliente è già iscritto).
 */
export async function getBookableMonth(packageId: string, month: string): Promise<BookableMonth> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { free: [], joinable: [] };
  const [pkg, settings, user] = await Promise.all([prisma.package.findUnique({ where: { id: packageId } }), getSettings(), getCurrentUser()]);
  if (!pkg || !pkg.active) return { free: [], joinable: [] };
  const { start, end } = monthRange(month);
  const notice = Number(settings.minNoticeHours || 0);
  const { timeWindows } = packageRules(pkg);
  const [free, joinable] = await Promise.all([
    freeSlotsBetween(start, end, notice),
    joinableLessons(pkg, start, end, notice, user?.id),
  ]);
  // basta che lo slot stia in una fascia: la lezione intera la controlla validateSelection
  const inWindows = (s: string) => inTimeWindows({ day: dayKey(s), start: s, slots: [s] }, timeWindows);
  return { free: free.filter(inWindows), joinable };
}

class ValidationFailed extends Error {
  constructor(public details: ValidationError[]) {
    super("VALIDATION");
  }
}

/** Una lezione di gruppo si è riempita mentre il cliente sceglieva. */
class LessonFull extends Error {}

export async function submitBooking(input: { packageId: string; slots: string[]; notes: string }): Promise<SubmitResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };
  if (!isProfileComplete(user)) return { ok: false, error: "PROFILE_INCOMPLETE" };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { packageId, notes } = parsed.data;
  const slots = parsed.data.slots.map((s) => new Date(s).toISOString());

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) return { ok: false, error: "PACKAGE_NOT_FOUND" };

  const [settings, rates] = await Promise.all([getSettings(), getRates()]);
  const times = slots.map((s) => Date.parse(s));
  const start = new Date(Math.min(...times));
  const end = new Date(Math.max(...times) + SLOT_MS);

  try {
    const request = await prisma.$transaction(async (tx) => {
      const notice = Number(settings.minNoticeHours || 0);
      const [free, joinable] = await Promise.all([
        freeSlotsBetween(start, end, notice, tx),
        joinableLessons(pkg, start, end, notice, user.id, tx),
      ]);
      const result = validateSelection(packageRules(pkg), slots, new Set(free), joinable);
      if (!result.ok) throw new ValidationFailed(result.errors);
      // prezzo congelato ora: un cambio di tariffario non altera le richieste già inviate
      const priceCents = priceForLessons(result.lessons.map((l) => l.slots.length * SLOT_MINUTES), rates);
      const request = await tx.bookingRequest.create({
        data: {
          userId: user.id,
          packageId: pkg.id,
          userNotes: notes,
          priceCents,
          billingJson: user.billingJson,
          slotsJson: JSON.stringify(slots.sort()),
        },
      });
      for (const l of result.lessons) {
        if (l.joined) {
          // iscrizione a una lezione già fissata: primo numero di posto libero (unique con la lezione)
          const j = joinable.find((x) => x.start === l.start && x.slotCount === l.slots.length)!;
          const taken = new Set((await tx.seat.findMany({ where: { lessonId: j.lessonId }, select: { seat: true } })).map((x) => x.seat));
          const max = taken.size + j.seatsLeft;
          const seat = Array.from({ length: max }, (_, i) => i + 1).find((n) => !taken.has(n));
          if (!seat) throw new LessonFull();
          await tx.seat.create({ data: { lessonId: j.lessonId, requestId: request.id, seat } });
        } else {
          await tx.lesson.create({
            data: {
              packageId: pkg.id,
              startAt: new Date(l.start),
              slotCount: l.slots.length,
              slots: { create: l.slots.map((s) => ({ startAt: new Date(s) })) },
              seats: { create: { requestId: request.id, seat: 1 } },
            },
          });
        }
      }
      return request;
    });

    try {
      await sendBookingEmails({ user, pkg, request, slots, adminEmails: await adminNotifyEmails(settings) });
    } catch (e) {
      console.error("Invio email prenotazione fallito", e);
    }
    return { ok: true, id: request.id };
  } catch (e) {
    if (e instanceof ValidationFailed) return { ok: false, error: "VALIDATION", details: e.details };
    if (e instanceof LessonFull) return { ok: false, error: "LESSON_FULL" };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "SLOT_TAKEN" };
    }
    throw e;
  }
}
