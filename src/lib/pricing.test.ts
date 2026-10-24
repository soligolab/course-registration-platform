import { describe, expect, it } from "vitest";
import { formatDuration, formatPrice, packageLessons, packagePrice, parseRates, priceForLessons, type Rate } from "./pricing";

const rates: Rate[] = [
  { minutes: 45, priceCents: 3000 },
  { minutes: 60, priceCents: 3800 },
  { minutes: 90, priceCents: 5500 },
];

describe("tariffario", () => {
  it("prezzo di un pacchetto a durata fissa = lezioni × tariffa", () => {
    // 8 lezioni da 45 minuti con slot da 15 minuti
    expect(packageLessons({ totalSlots: 24, minLessonSlots: 3, maxLessonSlots: 3 })).toEqual({ count: 8, minutes: 45 });
    expect(packagePrice({ totalSlots: 24, minLessonSlots: 3, maxLessonSlots: 3 }, rates)).toBe(24000);
    // 4 ore al mese in lezioni da 1 ora
    expect(packagePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 4 }, rates)).toBe(15200);
  });

  it("niente prezzo se la tariffa non è fissata o la durata è variabile", () => {
    expect(priceForLessons([60, 75], rates)).toBeNull();
    expect(packagePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 4 }, [{ minutes: 60, priceCents: null }])).toBeNull();
    expect(packagePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 8 }, rates)).toBeNull();
  });

  it("scarta tariffari non validi", () => {
    expect(parseRates([{ minutes: 60, priceCents: 1 }, { minutes: 60, priceCents: 2 }])).toHaveLength(3); // duplicato → default
    expect(parseRates([{ minutes: 50, priceCents: 1 }])).toHaveLength(3); // non multiplo di 15
    expect(parseRates([{ minutes: 90, priceCents: 1 }, { minutes: 45, priceCents: 2 }]).map((r) => r.minutes)).toEqual([45, 90]);
  });

  it("formatta durate e prezzi", () => {
    expect([45, 60, 90, 120].map(formatDuration)).toEqual(["45 min", "1 h", "1 h 30", "2 h"]);
    expect(formatPrice(3800, "it").replace(/\s/g, " ")).toBe("38 €");
    expect(formatPrice(3850, "en")).toBe("€38.50");
  });
});
