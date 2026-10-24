"use client";

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveThemeAction } from "@/app/actions/admin";
import { Hero } from "@/components/Hero";
import { MediaPicker } from "@/components/MediaPicker";
import { PackageCard } from "@/components/PackageCard";
import { DEFAULT_THEME, FONT_KEYS, FONT_LABELS, PRESETS, contrastWarnings, themeVars, type Theme, type ThemeKey } from "@/lib/theme";

type Field =
  | { key: ThemeKey; type: "color" | "bool" | "text" | "textarea" }
  | { key: ThemeKey; type: "range"; min: number; max: number; step?: number; unit?: string }
  | { key: ThemeKey; type: "select"; options: readonly (string | number)[] }
  | { key: ThemeKey; type: "font" }
  | { key: ThemeKey; type: "media"; kind: "logo" | "banner" };

const SECTIONS: { id: string; fields: Field[] }[] = [
  {
    id: "identity",
    fields: [
      { key: "logoUrl", type: "media", kind: "logo" },
      { key: "logoHeight", type: "range", min: 20, max: 120, unit: "px" },
      { key: "showName", type: "bool" },
    ],
  },
  {
    id: "colors",
    fields: (["primary", "accent", "neutral", "pageBg", "surface", "heading", "headerBg", "headerText", "footerBg", "footerText"] as const).map(
      (key) => ({ key, type: "color" as const }),
    ),
  },
  {
    id: "typography",
    fields: [
      { key: "headingFont", type: "font" },
      { key: "bodyFont", type: "font" },
      { key: "headingWeight", type: "select", options: [400, 500, 600, 700, 800] },
      { key: "baseSize", type: "range", min: 14, max: 19, unit: "px" },
    ],
  },
  {
    id: "shape",
    fields: [
      { key: "radius", type: "range", min: 0, max: 28, unit: "px" },
      { key: "buttonShape", type: "select", options: ["square", "rounded", "pill"] },
      { key: "shadow", type: "select", options: ["none", "soft", "medium", "strong"] },
      { key: "cardBorder", type: "bool" },
      { key: "cardAccentBar", type: "bool" },
    ],
  },
  {
    id: "layout",
    fields: [
      { key: "width", type: "select", options: ["narrow", "normal", "wide"] },
      { key: "headerSticky", type: "bool" },
      { key: "headerShadow", type: "bool" },
    ],
  },
  {
    id: "hero",
    fields: [
      { key: "heroEnabled", type: "bool" },
      { key: "heroImage", type: "media", kind: "banner" },
      { key: "heroHeight", type: "select", options: ["sm", "md", "lg", "xl"] },
      { key: "heroAlign", type: "select", options: ["left", "center"] },
      { key: "heroFullWidth", type: "bool" },
      { key: "heroOverlay", type: "color" },
      { key: "heroOverlayOpacity", type: "range", min: 0, max: 90, step: 5, unit: "%" },
      { key: "heroText", type: "color" },
      { key: "heroTitleIt", type: "text" },
      { key: "heroTitleEn", type: "text" },
      { key: "heroSubtitleIt", type: "textarea" },
      { key: "heroSubtitleEn", type: "textarea" },
      { key: "heroShowCta", type: "bool" },
      { key: "heroCtaIt", type: "text" },
      { key: "heroCtaEn", type: "text" },
    ],
  },
  {
    id: "packages",
    fields: [
      { key: "pkgImageStyle", type: "select", options: ["cover", "logo", "none"] },
      { key: "pkgCoverRatio", type: "select", options: ["wide", "classic", "square"] },
      { key: "pkgColumns", type: "select", options: [2, 3, 4] },
      { key: "showRates", type: "bool" },
    ],
  },
  {
    id: "footer",
    fields: [
      { key: "footerTextIt", type: "textarea" },
      { key: "footerTextEn", type: "textarea" },
    ],
  },
];

export function ThemeEditor({ initial, businessName }: { initial: Theme; businessName: string }) {
  const t = useTranslations("admin.theme");
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initial);
  const [saved, setSaved] = useState<Theme>(initial);
  const [open, setOpen] = useState<string>("colors");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const dirty = JSON.stringify(theme) !== JSON.stringify(saved);
  const warnings = useMemo(() => contrastWarnings(theme), [theme]);
  const set = <K extends ThemeKey>(key: K, value: Theme[K]) => {
    setMsg(null);
    setTheme((th) => ({ ...th, [key]: value }));
  };
  const opt = (key: ThemeKey, value: string | number) => {
    const k = `options.${key}.${value}` as "options.width.normal";
    return t.has(k) ? t(k) : String(value);
  };

  function save() {
    start(async () => {
      const res = await saveThemeAction(theme);
      if (res.ok) {
        setSaved(theme);
        setMsg({ ok: true, text: t("saved") });
        router.refresh();
      } else {
        setMsg({ ok: false, text: t("invalid", { fields: (res.errors ?? []).map((k) => t(`fields.${k}` as "fields.primary")).join(", ") }) });
      }
    });
  }

  function control(f: Field): ReactNode {
    const id = `th-${f.key}`;
    const v = theme[f.key];
    switch (f.type) {
      case "color":
        return <ColorField id={id} label={t(`fields.${f.key}` as "fields.primary")} value={v as string} onChange={(c) => set(f.key, c as never)} />;
      case "bool":
        return <input id={id} type="checkbox" checked={v as boolean} onChange={(e) => set(f.key, e.target.checked as never)} className="h-4 w-4" />;
      case "range":
        return (
          <div className="flex items-center gap-3">
            <input id={id} type="range" min={f.min} max={f.max} step={f.step ?? 1} value={v as number} onChange={(e) => set(f.key, Number(e.target.value) as never)} className="flex-1 accent-brand-600" />
            <span className="w-14 text-right text-sm tabular-nums text-slate-600">
              {v as number}
              {f.unit}
            </span>
          </div>
        );
      case "select":
        return (
          <select id={id} value={String(v)} onChange={(e) => set(f.key, (typeof f.options[0] === "number" ? Number(e.target.value) : e.target.value) as never)} className="input">
            {f.options.map((o) => (
              <option key={o} value={o}>
                {opt(f.key, o)}
              </option>
            ))}
          </select>
        );
      case "font":
        return (
          <select id={id} value={v as string} onChange={(e) => set(f.key, e.target.value as never)} className="input" style={{ fontFamily: themeVars({ ...theme, bodyFont: v as Theme["bodyFont"] })["--font-body"] }}>
            {FONT_KEYS.map((k) => (
              <option key={k} value={k}>
                {FONT_LABELS[k]}
              </option>
            ))}
          </select>
        );
      case "media":
        return <MediaPicker kind={f.kind} value={v as string} onChange={(url) => set(f.key, url as never)} />;
      case "textarea":
        return <textarea id={id} rows={2} value={v as string} onChange={(e) => set(f.key, e.target.value as never)} className="input" placeholder={t.has(`placeholders.${f.key}` as "placeholders.heroTitleIt") ? t(`placeholders.${f.key}` as "placeholders.heroTitleIt") : undefined} />;
      default:
        return <input id={id} value={v as string} onChange={(e) => set(f.key, e.target.value as never)} className="input" placeholder={t.has(`placeholders.${f.key}` as "placeholders.heroTitleIt") ? t(`placeholders.${f.key}` as "placeholders.heroTitleIt") : undefined} />;
    }
  }

  const previewStyle = { ...themeVars(theme), fontFamily: "var(--font-body)", backgroundColor: "rgb(var(--page-bg))" } as CSSProperties;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card">
          <h2 className="text-base font-semibold">{t("presets")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("presetsHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => setTheme((th) => ({ ...th, ...p.values }))} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-sm hover:border-brand-500">
                <span className="flex overflow-hidden rounded">
                  {[p.values.primary, p.values.accent, p.values.pageBg, p.values.heading].map((c) => (
                    <span key={c} className="h-6 w-3" style={{ backgroundColor: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.id} className="card p-0">
            <button type="button" onClick={() => setOpen(open === s.id ? "" : s.id)} className="flex w-full items-center justify-between px-5 py-3 text-left font-semibold">
              {t(`sections.${s.id}` as "sections.colors")}
              <span className="text-slate-400">{open === s.id ? "−" : "+"}</span>
            </button>
            {open === s.id && (
              <div className="space-y-4 border-t border-slate-100 px-5 py-4">
                {s.fields.map((f) =>
                  f.type === "bool" ? (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      {control(f)} {t(`fields.${f.key}` as "fields.primary")}
                    </label>
                  ) : (
                    <div key={f.key}>
                      <label htmlFor={`th-${f.key}`} className="label">
                        {t(`fields.${f.key}` as "fields.primary")}
                      </label>
                      {control(f)}
                      {t.has(`help.${f.key}` as "help.primary") && <p className="mt-1 text-xs text-slate-500">{t(`help.${f.key}` as "help.primary")}</p>}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        <div className="sticky bottom-0 z-10 -mx-1 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          {warnings.length > 0 && (
            <ul className="mb-2 space-y-0.5 text-xs text-amber-800">
              {warnings.map((w) => (
                <li key={w.key}>⚠ {t(`contrast.${w.key}` as "contrast.buttons", { ratio: w.ratio })}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!dirty || pending} onClick={save}>
              {t("save")}
            </button>
            <button type="button" className="btn-secondary" disabled={!dirty || pending} onClick={() => setTheme(saved)}>
              {t("undo")}
            </button>
            <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => confirm(t("resetConfirm")) && setTheme(DEFAULT_THEME)}>
              {t("reset")}
            </button>
            {msg ? <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span> : dirty && <span className="text-sm text-amber-700">{t("unsaved")}</span>}
          </div>
        </div>
      </div>

      {/* Anteprima: stesse classi e componenti del sito, con le variabili del tema in modifica */}
      <div className="lg:sticky lg:top-20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("preview")}</p>
        <div style={previewStyle} className="overflow-hidden rounded-xl border border-slate-300 text-slate-900 shadow-sm">
          <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3 text-sm" style={{ background: "rgb(var(--header-bg))", color: "rgb(var(--header-text))", boxShadow: theme.headerShadow ? "var(--shadow-card)" : undefined }}>
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" style={{ height: Math.min(theme.logoHeight, 56) }} />
            )}
            {(theme.showName || !theme.logoUrl) && <span className="text-lg font-semibold [font-family:var(--font-heading)]">{businessName}</span>}
            <span className="ml-auto opacity-85">{t("previewNav")}</span>
          </div>
          <div className="space-y-6 p-4">
            {theme.heroEnabled && (
              <Hero theme={theme} bleed={false} title={theme.heroTitleIt || t("placeholders.heroTitleIt")} subtitle={theme.heroSubtitleIt || t("placeholders.heroSubtitleIt")} cta={theme.heroCtaIt} ctaHref="#" />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <PackageCard
                theme={theme}
                name={t("sample.name")}
                description={t("sample.description")}
                imageUrl="/presets/corso-sole.svg"
                price="240 €"
                priceNote={t("sample.priceNote")}
                facts={
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li className="font-medium text-slate-800">{t("sample.fact1")}</li>
                    <li>{t("sample.fact2")}</li>
                  </ul>
                }
                action={
                  <span className="btn-primary w-full" role="presentation">
                    {t("sample.choose")}
                  </span>
                }
              />
              <div className="card space-y-3">
                <h3 className="text-lg">{t("sample.formTitle")}</h3>
                <input className="input" placeholder={t("sample.input")} readOnly />
                <div className="flex flex-wrap gap-2">
                  <span className="btn-primary">{t("sample.primary")}</span>
                  <span className="btn-secondary">{t("sample.secondary")}</span>
                  <span className="btn-accent">{t("sample.accent")}</span>
                </div>
                <p className="text-sm text-slate-600">{t("sample.text")}</p>
                <span className="badge bg-brand-100 text-brand-700">{t("sample.badge")}</span>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 text-xs" style={{ background: "rgb(var(--footer-bg))", color: "rgb(var(--footer-text))" }}>
            {theme.footerTextIt || "©"} {businessName}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{t("previewHint")}</p>
      </div>
    </div>
  );
}

/** Selettore + campo esadecimale; il valore passa al tema solo quando è un colore completo. */
function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (c: string) => void }) {
  const [text, setText] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    // cambiato da fuori (preset, annulla): riallinea il testo
    setLast(value);
    setText(value);
  }
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
      <input
        aria-label={label}
        value={text}
        maxLength={7}
        onChange={(e) => {
          const c = e.target.value.trim();
          setText(c);
          if (/^#[0-9a-fA-F]{6}$/.test(c)) onChange(c.toLowerCase());
        }}
        onBlur={() => setText(value)}
        className="input w-28 font-mono"
      />
    </div>
  );
}
