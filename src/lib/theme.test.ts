import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, PRESETS, contrast, contrastWarnings, parseTheme, themeSchema, themeVars } from "./theme";

describe("tema", () => {
  it("il default e i preset sono validi e leggibili", () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
    for (const p of PRESETS) {
      const t = { ...DEFAULT_THEME, ...p.values };
      expect(themeSchema.safeParse(t).success, p.id).toBe(true);
      expect(contrastWarnings(t), p.id).toEqual([]);
    }
  });

  it("un tema salvato rotto ricade sul default chiave per chiave", () => {
    const t = parseTheme({ primary: "#123456", accent: "rosso", radius: 999, logoUrl: "https://evil.example/x.png", extra: 1 });
    expect(t.primary).toBe("#123456");
    expect(t.accent).toBe(DEFAULT_THEME.accent);
    expect(t.radius).toBe(DEFAULT_THEME.radius);
    expect(t.logoUrl).toBe(DEFAULT_THEME.logoUrl);
    expect("extra" in t).toBe(false);
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
  });

  it("accetta solo immagini del portale", () => {
    const ok = (logoUrl: string) => themeSchema.shape.logoUrl.safeParse(logoUrl).success;
    expect(ok("/media/abc-1234abcd.png")).toBe(true);
    expect(ok("/presets/corso-sole.svg")).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("/media/../../etc/passwd")).toBe(false);
  });

  it("genera le variabili: il colore primario è la tonalità 600", () => {
    const v = themeVars({ ...DEFAULT_THEME, primary: "#b4532a", buttonShape: "pill" });
    expect(v["--brand-600"]).toBe("180 83 42");
    expect(v["--btn-radius"]).toBe("9999px");
    expect(Object.keys(v).filter((k) => k.startsWith("--slate-"))).toHaveLength(11);
  });

  it("segnala i contrasti insufficienti", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    const w = contrastWarnings({ ...DEFAULT_THEME, primary: "#f2c14e" });
    expect(w.map((x) => x.key)).toContain("buttons");
  });
});
