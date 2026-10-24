import { formatPrice, type PackagePricing } from "@/lib/pricing";

/**
 * Prezzo di un pacchetto: prezzo del pacchetto in grande; se è scontato, accanto la base
 * (lezioni × tariffa) barrata e la percentuale di sconto. Presentazionale: lo usano anche le anteprime.
 */
export function PackagePrice({
  pricing,
  locale,
  note,
  size = "md",
}: {
  pricing: PackagePricing;
  locale: string;
  note?: string;
  size?: "md" | "lg";
}) {
  if (pricing.price == null) return null;
  const pct = pricing.discountPct != null ? new Intl.NumberFormat(locale === "en" ? "en-IE" : "it-IT", { style: "percent" }).format(-pricing.discountPct / 100) : null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`font-semibold text-brand-700 ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{formatPrice(pricing.price, locale)}</span>
      {pricing.base != null && <span className="text-base text-slate-400 line-through">{formatPrice(pricing.base, locale)}</span>}
      {pct && <span className="badge bg-accent-500 font-semibold text-slate-950">{pct}</span>}
      {note && <span className="basis-full text-xs text-slate-500">{note}</span>}
    </p>
  );
}
