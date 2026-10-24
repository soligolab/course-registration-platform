import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sanitizeRichHtml } = await import("./rich-text");

describe("sanitizeRichHtml", () => {
  it("mantiene l'impaginazione dell'editor", () => {
    const html =
      '<h2 style="text-align: center">Titolo</h2><p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s></p>' +
      '<blockquote><p>q</p></blockquote><ul><li><p>x</p></li></ul><hr>' +
      '<img src="/media/abc-0123abcd.jpg" alt="foto" data-align="left">' +
      '<div data-columns=""><div data-column=""><p>1</p></div><div data-column=""><p>2</p></div></div>';
    // differenze solo di forma: spazi negli stili, attributi vuoti, tag autochiusi
    const norm = (s: string) => s.replace(/: /g, ":").replace(/=""/g, "").replace(/ ?\/?>/g, ">");
    expect(norm(sanitizeRichHtml(html))).toBe(norm(html));
  });

  it("toglie script, eventi e stili non previsti", () => {
    const out = sanitizeRichHtml('<p style="color:red" onclick="x()">a<script>alert(1)</script></p><iframe src="https://x"></iframe>');
    expect(out).toBe("<p>a</p>");
  });

  it("accetta solo immagini interne al portale", () => {
    expect(sanitizeRichHtml('<p>a</p><img src="https://evil.example/x.png">')).toBe("<p>a</p>");
    expect(sanitizeRichHtml('<p>a</p><img src="data:image/png;base64,AAAA">')).toBe("<p>a</p>");
    expect(sanitizeRichHtml('<img src="/presets/corso-sole.svg">')).toBe('<img src="/presets/corso-sole.svg" />');
  });

  it("link: solo http(s) e mailto, aperti in una nuova scheda", () => {
    expect(sanitizeRichHtml('<p><a href="javascript:alert(1)">x</a></p>')).toBe('<p><a target="_blank" rel="noopener noreferrer">x</a></p>');
    expect(sanitizeRichHtml('<p><a href="https://example.com" onclick="x">x</a></p>')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a></p>',
    );
  });

  it("un editor vuoto diventa stringa vuota", () => {
    expect(sanitizeRichHtml("<p></p>")).toBe("");
    expect(sanitizeRichHtml("  ")).toBe("");
  });
});
