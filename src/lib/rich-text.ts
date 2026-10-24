import "server-only";
import sanitizeHtml from "sanitize-html";

/*
 * Descrizione completa dei pacchetti: HTML prodotto dall'editor (RichTextEditor), salvato e mostrato
 * solo dopo questa pulizia. Restano i tag dell'editor; le immagini solo se interne al portale
 * (/media/…, /presets/…), i link solo http(s) e mailto. Così un admin non può inserire script
 * che girerebbero nel browser dei clienti o degli altri admin.
 */
export const MAX_DETAILS_LENGTH = 100_000;

const ALIGN = /^(left|center|right|justify)$/;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "hr", "br", "img", "div"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "data-align"],
    div: ["data-columns", "data-column"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
  },
  allowedStyles: { "*": { "text-align": [ALIGN] } },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer" } }),
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !/^\/(media|presets)\/[\w.-]+$/.test(frame.attribs.src ?? ""),
};

export function sanitizeRichHtml(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS).trim();
  // l'editor vuoto produce "<p></p>": lo si salva come stringa vuota
  return sanitizeHtml(clean, { allowedTags: ["img"], allowedAttributes: false }).trim() === "" ? "" : clean;
}

/** Descrizione completa nella lingua richiesta, o nell'altra se manca. Ripulita di nuovo per i dati scritti fuori dall'editor. */
export function packageDetails(pkg: { detailsIt: string; detailsEn: string }, locale: string): string {
  const [first, second] = locale === "en" ? [pkg.detailsEn, pkg.detailsIt] : [pkg.detailsIt, pkg.detailsEn];
  return sanitizeRichHtml(first || second);
}
