import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Slot da 15 minuti (SLOT_MINUTES in src/lib/time.ts): 1 ora = 4 slot, 45 minuti = 3 slot.
// Ogni pacchetto ha una durata di lezione fissa (min = max = blocco), prezzata dal tariffario.
const lessons = (count: number, minutes: number) => {
  const slots = minutes / 15;
  return { totalSlots: count * slots, minLessonSlots: slots, maxLessonSlots: slots, lessonStepSlots: slots };
};

async function main() {
  if ((await prisma.package.count()) > 0) {
    console.log("Pacchetti già presenti, seed saltato.");
    return;
  }
  await prisma.package.createMany({
    data: [
      {
        nameIt: "4 ore al mese",
        nameEn: "4 hours a month",
        descriptionIt: "Quattro lezioni da un'ora da distribuire nell'arco di un mese.",
        descriptionEn: "Four one-hour lessons spread over a month.",
        ...lessons(4, 60),
        validityDays: 31,
        sortOrder: 1,
        imageUrl: "/presets/corso-sole.svg",
      },
      {
        nameIt: "8 ore al mese",
        nameEn: "8 hours a month",
        descriptionIt: "Otto lezioni da un'ora nell'arco di un mese, per un percorso più intenso.",
        descriptionEn: "Eight one-hour lessons over a month, for a more intensive path.",
        ...lessons(8, 60),
        validityDays: 31,
        sortOrder: 2,
        imageUrl: "/presets/corso-foglia.svg",
      },
      {
        nameIt: "8 lezioni da 45 minuti",
        nameEn: "8 lessons of 45 minutes",
        descriptionIt: "Otto lezioni brevi da 45 minuti, ideali per un ritmo costante.",
        descriptionEn: "Eight short 45-minute lessons, ideal for a steady pace.",
        ...lessons(8, 45),
        validityDays: 31,
        sortOrder: 3,
        imageUrl: "/presets/corso-onda.svg",
      },
    ],
  });
  console.log("Pacchetti base creati.");
}

main().finally(() => prisma.$disconnect());
