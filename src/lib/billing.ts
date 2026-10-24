import { z } from "zod";

/*
 * Dati di fatturazione del cliente. L'intestatario può essere diverso dall'allievo (es. il genitore
 * di un minore) oppure un'azienda/professionista con partita IVA. Salvati come JSON in
 * User.billingJson; ogni richiesta ne conserva una copia (BookingRequest.billingJson), così la
 * fattura usa i dati validi al momento della richiesta. Per clienti esteri i controlli italiani
 * (codice fiscale, P.IVA, CAP, provincia) non si applicano.
 */

/* ---------- controlli formali italiani ---------- */

const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const CF_ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const cfEven = (c: string) => (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);

/** Codice fiscale di persona fisica (16 caratteri), carattere di controllo compreso. */
export function isValidCodiceFiscale(raw: string): boolean {
  const cf = raw.toUpperCase();
  if (!CF_RE.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += i % 2 === 0 ? CF_ODD[cf[i]] : cfEven(cf[i]);
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}

/** Partita IVA italiana (11 cifre), cifra di controllo compresa. Vale anche per il CF numerico delle società. */
export function isValidPartitaIva(raw: string): boolean {
  if (!/^\d{11}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = Number(raw[i]);
    if (i % 2 === 0) sum += d;
    else sum += d * 2 > 9 ? d * 2 - 9 : d * 2;
  }
  return (10 - (sum % 10)) % 10 === Number(raw[10]);
}

/* ---------- schema ---------- */

const clean = (max: number) => z.string().trim().max(max);
const upper = (max: number) => clean(max).transform((s) => s.toUpperCase().replace(/\s+/g, ""));

const base = {
  street: clean(120).pipe(z.string().min(1)),
  zip: upper(12).pipe(z.string().min(1)),
  city: clean(80).pipe(z.string().min(1)),
  province: upper(40).default(""),
  country: upper(2).pipe(z.string().regex(/^[A-Z]{2}$/)),
};

const rawSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PRIVATE"),
    firstName: clean(80).pipe(z.string().min(1)),
    lastName: clean(80).pipe(z.string().min(1)),
    taxCode: upper(30).default(""),
    ...base,
  }),
  z.object({
    type: z.literal("BUSINESS"),
    companyName: clean(160).pipe(z.string().min(1)),
    // "IT12345678901" → "12345678901": il prefisso del paese è già nel campo country
    vatNumber: upper(20).transform((s) => s.replace(/^IT(?=\d{11}$)/, "")),
    taxCode: upper(16).default(""),
    sdiCode: upper(7).default(""),
    pec: clean(120).default(""),
    ...base,
  }),
]);

export const billingSchema = rawSchema.superRefine((b, ctx) => {
  const err = (path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path] });
  const it = b.country === "IT";
  if (it) {
    if (!/^\d{5}$/.test(b.zip)) err("zip");
    if (!/^[A-Z]{2}$/.test(b.province)) err("province");
  }
  if (b.type === "PRIVATE") {
    if (it ? !isValidCodiceFiscale(b.taxCode) : b.taxCode.length > 0 && !/^[A-Z0-9-]{4,30}$/.test(b.taxCode)) err("taxCode");
  } else {
    if (it ? !isValidPartitaIva(b.vatNumber) : !/^[A-Z0-9-]{4,20}$/.test(b.vatNumber)) err("vatNumber");
    // CF dell'azienda: facoltativo se coincide con la P.IVA; numerico (società) o personale (ditte individuali)
    if (b.taxCode && it && !isValidPartitaIva(b.taxCode) && !isValidCodiceFiscale(b.taxCode)) err("taxCode");
    if (b.sdiCode && !/^[A-Z0-9]{7}$/.test(b.sdiCode)) err("sdiCode");
    if (b.pec && !z.string().email().safeParse(b.pec).success) err("pec");
  }
});

export type Billing = z.infer<typeof rawSchema>;

export function parseBilling(json: string | null | undefined): Billing | null {
  if (!json) return null;
  try {
    const r = billingSchema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Intestazione leggibile, riga per riga (email all'admin, dettaglio richiesta, copia negli appunti). */
export function billingLines(b: Billing, labels: { taxCode: string; vat: string; sdi: string; pec: string }): string[] {
  const lines: string[] = [];
  if (b.type === "PRIVATE") {
    lines.push(`${b.firstName} ${b.lastName}`);
    if (b.taxCode) lines.push(`${labels.taxCode}: ${b.taxCode}`);
  } else {
    lines.push(b.companyName);
    lines.push(`${labels.vat}: ${b.country === "IT" ? "IT" : ""}${b.vatNumber}`);
    if (b.taxCode && b.taxCode !== b.vatNumber) lines.push(`${labels.taxCode}: ${b.taxCode}`);
  }
  lines.push(b.street);
  lines.push([b.zip, b.city, b.province && `(${b.province})`].filter(Boolean).join(" ") + (b.country === "IT" ? "" : ` – ${b.country}`));
  if (b.type === "BUSINESS") {
    if (b.sdiCode) lines.push(`${labels.sdi}: ${b.sdiCode}`);
    if (b.pec) lines.push(`${labels.pec}: ${b.pec}`);
  }
  return lines;
}

/** Paesi proposti nel modulo (nomi tradotti dal browser con Intl.DisplayNames). */
export const COUNTRIES = [
  "IT", "SM", "VA", "CH", "AT", "BE", "BG", "CY", "HR", "DK", "EE", "FI", "FR", "DE", "GR", "IE", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "CZ", "RO", "SK", "SI", "ES", "SE", "HU", "GB", "NO", "US",
] as const;
