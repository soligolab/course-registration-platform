"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PRESET_IMAGES, type MediaKind } from "@/lib/presets";

type Upload = { url: string; name: string; size: number };

/**
 * Scelta di un'immagine: esempi inclusi nel portale, immagini già caricate o caricamento nuovo.
 * Con `name` scrive anche un input hidden, per i form che inviano FormData.
 */
export function MediaPicker({
  value,
  onChange,
  kind,
  name,
}: {
  value: string;
  onChange: (url: string) => void;
  kind: MediaKind;
  name?: string;
}) {
  const t = useTranslations("admin.media");
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && uploads === null) {
      fetch("/api/admin/media")
        .then((r) => (r.ok ? r.json() : []))
        .then(setUploads)
        .catch(() => setUploads([]));
    }
  }, [open, uploads]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const r = await fetch("/api/admin/media", { method: "POST", body });
      const data = await r.json();
      if (!r.ok) return setError(t.has(`errors.${data.error}` as "errors.BAD_TYPE") ? t(`errors.${data.error}` as "errors.BAD_TYPE") : t("errors.generic"));
      setUploads((u) => [data, ...(u ?? [])]);
      onChange(data.url);
      setOpen(false);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(u: Upload) {
    if (!confirm(t("deleteConfirm"))) return;
    const r = await fetch(`/api/admin/media?name=${encodeURIComponent(u.name)}`, { method: "DELETE" });
    if (r.ok) setUploads((list) => (list ?? []).filter((x) => x.name !== u.name));
    else setError(r.status === 409 ? t("errors.IN_USE") : t("errors.generic"));
  }

  const thumb = kind === "banner" ? "aspect-[8/3] w-full" : "aspect-square w-full";
  const tile = (url: string, label: string, extra?: ReactNode) => (
    <div key={url} className="relative">
      <button
        type="button"
        onClick={() => {
          onChange(url);
          setOpen(false);
        }}
        className={`block w-full overflow-hidden rounded-md border-2 ${value === url ? "border-brand-600" : "border-transparent hover:border-slate-300"}`}
        title={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className={`${thumb} bg-slate-100 object-cover`} loading="lazy" />
      </button>
      {extra}
    </div>
  );

  return (
    <div>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex items-center gap-3">
        <div className={`overflow-hidden rounded-md border border-slate-200 bg-slate-100 ${kind === "banner" ? "h-16 w-40" : "h-16 w-16"}`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-slate-400">{t("none")}</span>
          )}
        </div>
        <button type="button" className="btn-secondary py-1.5" onClick={() => setOpen((o) => !o)}>
          {open ? t("close") : t("choose")}
        </button>
        {value && (
          <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => onChange("")}>
            {t("remove")}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("presets")}</p>
            <div className={`grid gap-2 ${kind === "banner" ? "grid-cols-2" : "grid-cols-5"}`}>
              {PRESET_IMAGES[kind].map((p) => tile(p.url, p.label))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("uploaded")}</p>
            {uploads === null ? (
              <p className="text-sm text-slate-500">…</p>
            ) : uploads.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noUploads")}</p>
            ) : (
              <div className={`grid gap-2 ${kind === "banner" ? "grid-cols-2" : "grid-cols-5"}`}>
                {uploads.map((u) =>
                  tile(
                    u.url,
                    u.name,
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs text-red-600 shadow hover:bg-white"
                      aria-label={t("delete")}
                      title={t("delete")}
                    >
                      ×
                    </button>,
                  ),
                )}
              </div>
            )}
          </div>
          <div>
            <label className="btn-primary cursor-pointer py-1.5">
              {busy ? t("uploading") : t("upload")}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">{t(kind === "banner" ? "hintBanner" : "hintLogo")}</p>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
