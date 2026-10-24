import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Slot prenotabili (ISO) nell'intervallo: disponibili, non prenotati, oltre il preavviso minimo. */
export async function freeSlotsBetween(
  start: Date,
  end: Date,
  minNoticeHours: number,
  db: Prisma.TransactionClient = prisma,
): Promise<string[]> {
  const notice = new Date(Date.now() + minNoticeHours * 3_600_000);
  const from = start > notice ? start : notice;
  if (from >= end) return [];
  const [available, booked] = await Promise.all([
    db.availabilitySlot.findMany({ where: { startAt: { gte: from, lt: end } }, orderBy: { startAt: "asc" } }),
    db.bookedSlot.findMany({ where: { startAt: { gte: from, lt: end } }, select: { startAt: true } }),
  ]);
  const taken = new Set(booked.map((b) => b.startAt.getTime()));
  return available.filter((a) => !taken.has(a.startAt.getTime())).map((a) => a.startAt.toISOString());
}
