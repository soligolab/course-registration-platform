import "server-only";
import type { Package, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fixedLessonSlots } from "@/lib/booking/validate";

type Db = Prisma.TransactionClient;

const noticeFrom = (start: Date, minNoticeHours: number) => {
  const notice = new Date(Date.now() + minNoticeHours * 3_600_000);
  return start > notice ? start : notice;
};

/** Slot prenotabili (ISO) nell'intervallo: disponibili, non occupati da lezioni, oltre il preavviso minimo. */
export async function freeSlotsBetween(start: Date, end: Date, minNoticeHours: number, db: Db = prisma): Promise<string[]> {
  const from = noticeFrom(start, minNoticeHours);
  if (from >= end) return [];
  const [available, booked] = await Promise.all([
    db.availabilitySlot.findMany({ where: { startAt: { gte: from, lt: end } }, orderBy: { startAt: "asc" } }),
    db.bookedSlot.findMany({ where: { startAt: { gte: from, lt: end } }, select: { startAt: true } }),
  ]);
  const taken = new Set(booked.map((b) => b.startAt.getTime()));
  return available.filter((a) => !taken.has(a.startAt.getTime())).map((a) => a.startAt.toISOString());
}

export type JoinableInfo = { lessonId: string; start: string; slotCount: number; seatsLeft: number };

/**
 * Lezioni già fissate a cui un cliente del pacchetto può unirsi: dello stesso pacchetto o dello stesso
 * gruppo, con la stessa durata, posti liberi (massimo del pacchetto che ha fissato la lezione) e oltre il preavviso.
 * `excludeUserId`: si tolgono le lezioni in cui il cliente ha già un posto.
 */
export async function joinableLessons(
  pkg: Package,
  start: Date,
  end: Date,
  minNoticeHours: number,
  excludeUserId?: string,
  db: Db = prisma,
): Promise<JoinableInfo[]> {
  const size = fixedLessonSlots(pkg);
  const from = noticeFrom(start, minNoticeHours);
  if (!size || from >= end) return [];
  const lessons = await db.lesson.findMany({
    where: {
      startAt: { gte: from, lt: end },
      slotCount: size,
      package: pkg.groupKey ? { groupKey: pkg.groupKey } : { id: pkg.id },
      ...(excludeUserId ? { seats: { none: { request: { userId: excludeUserId } } } } : {}),
    },
    include: { package: { select: { maxParticipants: true } }, _count: { select: { seats: true } } },
    orderBy: { startAt: "asc" },
  });
  return lessons
    .filter((l) => l._count.seats < l.package.maxParticipants)
    .map((l) => ({
      lessonId: l.id,
      start: l.startAt.toISOString(),
      slotCount: l.slotCount,
      seatsLeft: l.package.maxParticipants - l._count.seats,
    }));
}

/** Le lezioni senza più partecipanti liberano l'orario (i BookedSlot si cancellano a cascata). */
export function deleteEmptyLessons(db: Db = prisma) {
  return db.lesson.deleteMany({ where: { seats: { none: {} } } });
}
