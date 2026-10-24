import "server-only";
import { prisma } from "@/lib/db";
import { formatDuration, type Rate } from "@/lib/pricing";
import { SLOT_MINUTES } from "@/lib/time";

/*
 * Lezioni singole: per ogni durata del tariffario con un prezzo c'è un pacchetto kind = "SINGLE" da una
 * lezione, senza prezzo proprio (vale la tariffa). Così la prenotazione usa lo stesso calendario, le stesse
 * regole e le stesse richieste dei pacchetti. Non compaiono tra i pacchetti: si prenotano dalla sezione
 * Tariffe della home. Le durate tolte o senza prezzo restano disattivate (possono avere richieste).
 */
export async function syncSingleLessonPackages(rates: Rate[]) {
  const existing = await prisma.package.findMany({ where: { kind: "SINGLE" } });
  const priced = rates.filter((r) => r.priceCents != null);
  for (const r of priced) {
    const slots = r.minutes / SLOT_MINUTES;
    const data = {
      nameIt: r.labelIt || `Lezione singola da ${formatDuration(r.minutes)}`,
      nameEn: r.labelEn || `Single lesson, ${formatDuration(r.minutes)}`,
      descriptionIt: r.textIt ?? "",
      descriptionEn: r.textEn ?? "",
      totalSlots: slots,
      minLessonSlots: slots,
      maxLessonSlots: slots,
      lessonStepSlots: slots,
      validityDays: 1,
      priceCents: null,
      active: true,
    };
    const pkg = existing.find((p) => p.minLessonSlots === slots);
    if (pkg) await prisma.package.update({ where: { id: pkg.id }, data });
    else await prisma.package.create({ data: { ...data, kind: "SINGLE", sortOrder: 1000 } });
  }
  const keep = new Set(priced.map((r) => r.minutes / SLOT_MINUTES));
  await prisma.package.updateMany({
    where: { kind: "SINGLE", minLessonSlots: { notIn: [...keep] } },
    data: { active: false },
  });
}

/** Pacchetto "lezione singola" attivo per ogni durata (minuti → id). */
export async function singleLessonPackageIds(): Promise<Map<number, string>> {
  const pkgs = await prisma.package.findMany({ where: { kind: "SINGLE", active: true }, select: { id: true, minLessonSlots: true } });
  return new Map(pkgs.map((p) => [p.minLessonSlots * SLOT_MINUTES, p.id]));
}
