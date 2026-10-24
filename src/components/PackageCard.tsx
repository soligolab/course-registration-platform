import type { ReactNode } from "react";
import { COVER_RATIO_CLASS, type Theme } from "@/lib/theme";

/** Scheda di un pacchetto. Presentazionale: la usano la home e l'anteprima di Admin → Aspetto. */
export function PackageCard({
  theme,
  name,
  description,
  imageUrl,
  price,
  priceNote,
  facts,
  action,
}: {
  theme: Theme;
  name: string;
  description: string;
  imageUrl: string;
  price: string | null;
  priceNote: string;
  facts: ReactNode;
  action: ReactNode;
}) {
  const style = imageUrl ? theme.pkgImageStyle : "none";
  return (
    <div className={`card flex flex-col overflow-hidden ${theme.cardAccentBar ? "border-t-4 border-t-accent-500" : ""}`}>
      {style === "cover" && (
        <div className={`-mx-5 -mt-5 mb-4 ${COVER_RATIO_CLASS[theme.pkgCoverRatio]} overflow-hidden bg-slate-100`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start gap-3">
        {style === "logo" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-[var(--input-radius)] object-cover" />
        )}
        <div className="min-w-0">
          <h2 className="text-xl">{name}</h2>
          {price && (
            <p className="mt-1">
              <span className="text-2xl font-semibold text-brand-700">{price}</span>{" "}
              <span className="text-xs text-slate-500">{priceNote}</span>
            </p>
          )}
        </div>
      </div>
      {description && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{description}</p>}
      <div className="mt-4 flex-1">{facts}</div>
      <div className="mt-5 flex">{action}</div>
    </div>
  );
}
