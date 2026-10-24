import { useTranslations } from "next-intl";

const TONES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return <span className={`badge ${TONES[status] ?? ""}`}>{t(status as "PENDING")}</span>;
}
