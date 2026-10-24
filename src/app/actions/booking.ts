"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, isProfileComplete } from "@/lib/auth";
import { freeSlotsBetween } from "@/lib/availability";
import { validateSelection, type ValidationError } from "@/lib/booking/validate";
import { sendBookingEmails } from "@/lib/mail";
import { priceForLessons } from "@/lib/pricing";
import { adminNotifyEmails, getRates, getSettings } from "@/lib/settings";
import { SLOT_MINUTES, SLOT_MS, monthRange } from "@/lib/time";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; error: string; details?: ValidationError[] };

const inputSchema = z.object({
  packageId: z.string().min(1),
  slots: z.array(z.string().datetime()).min(1).max(500),
  notes: z.string().max(2000).default(""),
});

/** Slot prenotabili di un mese "YYYY-MM" (pubblico). */
export async function getFreeMonth(month: string): Promise<string[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const settings = await getSettings();
  const { start, end } = monthRange(month);
  return freeSlotsBetween(start, end, Number(settings.minNoticeHours || 0));
}

class ValidationFailed extends Error {
  constructor(public details: ValidationError[]) {
    super("VALIDATION");
  }
}

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
      const free = await freeSlotsBetween(start, end, Number(settings.minNoticeHours || 0), tx);
      const result = validateSelection(pkg, slots, new Set(free));
      if (!result.ok) throw new ValidationFailed(result.errors);
      // prezzo congelato ora: un cambio di tariffario non altera le richieste già inviate
      const priceCents = priceForLessons(result.lessons.map((l) => l.slots.length * SLOT_MINUTES), rates);
      return tx.bookingRequest.create({
        data: {
          userId: user.id,
          packageId: pkg.id,
          userNotes: notes,
          priceCents,
          billingJson: user.billingJson,
          slotsJson: JSON.stringify(slots.sort()),
          slots: { create: slots.map((s) => ({ startAt: new Date(s) })) },
        },
      });
    });

    try {
      await sendBookingEmails({ user, pkg, request, slots, adminEmails: await adminNotifyEmails(settings) });
    } catch (e) {
      console.error("Invio email prenotazione fallito", e);
    }
    return { ok: true, id: request.id };
  } catch (e) {
    if (e instanceof ValidationFailed) return { ok: false, error: "VALIDATION", details: e.details };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "SLOT_TAKEN" };
    }
    throw e;
  }
}
