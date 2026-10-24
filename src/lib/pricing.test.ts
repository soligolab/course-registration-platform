import { describe, expect, it } from "vitest";
import { basePrice, formatDuration, formatPrice, packageLessons, packagePricing, parseRates, priceForLessons, type Rate } from "./pricing";

const rates: Rate[] = [
  { minutes: 45, priceCents: 3000 },
  { minutes: 60, priceCents: 3800 },
  { minutes: 90, priceCents: 5500 },
];

describe("tariffario", () => {
  it("prezzo di base di un pacchetto a durata fissa = lezioni × tariffa", () => {
    // 8 lezioni da 45 minuti con slot da 15 minuti
    expect(packageLessons({ totalSlots: 24, minLessonSlots: 3, maxLessonSlots: 3 })).toEqual({ count: 8, minutes: 45 });
    expect(basePrice({ totalSlots: 24, minLessonSlots: 3, maxLessonSlots: 3 }, rates)).toBe(24000);
    // 4 ore al mese in lezioni da 1 ora
    expect(basePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 4 }, rates)).toBe(15200);
  });

  it("niente prezzo se la tariffa non è fissata o la durata è variabile", () => {
    expect(priceForLessons([60, 75], rates)).toBeNull();
    expect(basePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 4 }, [{ minutes: 60, priceCents: null }])).toBeNull();
    expect(basePrice({ totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 8 }, rates)).toBeNull();
  });

  it("prezzo del pacchetto configurato: base barrata e sconto", () => {
    const fourHours = { totalSlots: 16, minLessonSlots: 4, maxLessonSlots: 4 }; // base 152 €
    expect(packagePricing({ ...fourHours, priceCents: null }, rates)).toEqual({ price: 15200, base: null, discountPct: null });
    expect(packagePricing({ ...fourHours, priceCents: 12900 }, rates)).toEqual({ price: 12900, base: 15200, discountPct: 15 });
    // nessuno sconto se il prezzo è uguale o maggiore della base
    expect(packagePricing({ ...fourHours, priceCents: 15200 }, rates).discountPct).toBeNull();
    expect(packagePricing({ ...fourHours, priceCents: 16000 }, rates)).toEqual({ price: 16000, base: null, discountPct: null });
    // tariffa non fissata: vale solo il prezzo configurato
    expect(packagePricing({ ...fourHours, priceCents: 9000 }, [{ minutes: 60, priceCents: null }])).toEqual({ price: 9000, base: null, discountPct: null });
    expect(packagePricing({ ...fourHours, priceCents: null }, [{ minutes: 60, priceCents: null }]).price).toBeNull();
    // arrotondamento: 1 - 100/152 = 34,2 %
    expect(packagePricing({ ...fourHours, priceCents: 10000 }, rates).discountPct).toBe(34);
  });

  it("tariffe salvate prima dei testi delle schede restano valide", () => {
    expect(parseRates([{ minutes: 60, priceCents: 2200 }])[0]).toEqual({ minutes: 60, priceCents: 2200, labelIt: "", labelEn: "", textIt: "", textEn: "" });
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
