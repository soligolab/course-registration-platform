import { describe, expect, it } from "vitest";
import { billingLines, billingSchema, isValidCodiceFiscale, isValidPartitaIva, parseBilling } from "./billing";

const addr = { street: "Via Roma 1", zip: "35100", city: "Padova", province: "pd", country: "it" };
const labels = { taxCode: "C.F.", vat: "P.IVA", sdi: "SDI", pec: "PEC" };
const failedPaths = (v: unknown) => {
  const r = billingSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe("controlli formali", () => {
  it("codice fiscale", () => {
    expect(isValidCodiceFiscale("RSSMRA85T10A562S")).toBe(true);
    expect(isValidCodiceFiscale("rssmra85t10a562s")).toBe(true);
    expect(isValidCodiceFiscale("RSSMRA85T10A562X")).toBe(false); // controllo sbagliato
    expect(isValidCodiceFiscale("RSSMRA85T10A562")).toBe(false);
  });

  it("partita IVA", () => {
    expect(isValidPartitaIva("12345678903")).toBe(true);
    expect(isValidPartitaIva("12345678901")).toBe(false);
    expect(isValidPartitaIva("1234567890")).toBe(false);
  });
});

describe("schema di fatturazione", () => {
  it("privato italiano: normalizza e richiede un codice fiscale valido", () => {
    const r = billingSchema.parse({ type: "PRIVATE", firstName: " Anna ", lastName: "Rossi", taxCode: "rssmra 85t10 a562s", ...addr });
    expect(r).toMatchObject({ firstName: "Anna", taxCode: "RSSMRA85T10A562S", province: "PD", country: "IT" });
    expect(failedPaths({ type: "PRIVATE", firstName: "A", lastName: "R", taxCode: "", ...addr })).toEqual(["taxCode"]);
  });

  it("azienda italiana: P.IVA con o senza prefisso IT, SDI e PEC facoltativi ma corretti", () => {
    const r = billingSchema.parse({ type: "BUSINESS", companyName: "Bottega Srl", vatNumber: "IT 12345678903", sdiCode: "abc1234", ...addr });
    expect(r).toMatchObject({ vatNumber: "12345678903", sdiCode: "ABC1234" });
    expect(failedPaths({ type: "BUSINESS", companyName: "X", vatNumber: "12345678901", sdiCode: "123", pec: "no", ...addr }).sort()).toEqual(["pec", "sdiCode", "vatNumber"]);
  });

  it("controlli italiani su CAP e provincia", () => {
    expect(failedPaths({ type: "PRIVATE", firstName: "A", lastName: "R", taxCode: "RSSMRA85T10A562S", ...addr, zip: "351", province: "" }).sort()).toEqual(["province", "zip"]);
  });

  it("cliente estero: niente controlli italiani", () => {
    const de = { street: "Hauptstr. 5", zip: "80331", city: "München", country: "DE" };
    expect(failedPaths({ type: "PRIVATE", firstName: "Max", lastName: "Muster", ...de })).toEqual([]);
    expect(failedPaths({ type: "BUSINESS", companyName: "Muster GmbH", vatNumber: "DE123456789", ...de })).toEqual([]);
  });

  it("dati salvati non validi = incompleti", () => {
    expect(parseBilling(null)).toBeNull();
    expect(parseBilling("{rotto")).toBeNull();
    expect(parseBilling(JSON.stringify({ type: "PRIVATE", firstName: "A" }))).toBeNull();
  });

  it("intestazione leggibile", () => {
    const b = billingSchema.parse({ type: "BUSINESS", companyName: "Bottega Srl", vatNumber: "12345678903", pec: "fatture@pec.it", ...addr });
    expect(billingLines(b, labels)).toEqual(["Bottega Srl", "P.IVA: IT12345678903", "Via Roma 1", "35100 Padova (PD)", "PEC: fatture@pec.it"]);
  });
});
