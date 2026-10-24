"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { saveAdminNotes, updateRequestStatus } from "@/app/actions/admin";

export function RequestActions({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) {
  const t = useTranslations("admin.requests");
  const router = useRouter();
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState(adminNotes);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const change = (next: "CONFIRMED" | "REJECTED" | "CANCELLED") => {
    if (next !== "CONFIRMED" && !confirm(t("confirmAction"))) return;
    start(async () => {
      const res = await updateRequestStatus(id, next, notify);
      if (!res.ok) setError(res.error ?? "error");
      router.refresh();
    });
  };

  return (
    <div className="mt-5 space-y-5">
      {(status === "PENDING" || status === "CONFIRMED") && (
        <div className="card space-y-3">
          <div className="flex flex-wrap gap-2">
            {status === "PENDING" && (
              <>
                <button className="btn-primary" disabled={pending} onClick={() => change("CONFIRMED")}>
                  {t("confirm")}
                </button>
                <button className="btn-secondary" disabled={pending} onClick={() => change("REJECTED")}>
                  {t("reject")}
                </button>
              </>
            )}
            <button className="btn-danger" disabled={pending} onClick={() => change("CANCELLED")}>
              {t("cancel")}
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            {t("notify")}
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="card space-y-3">
        <label htmlFor="adminNotes" className="label">
          {t("adminNotes")}
        </label>
        <textarea id="adminNotes" className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button
          className="btn-secondary"
          disabled={pending || notes === adminNotes}
          onClick={() => start(async () => {
            await saveAdminNotes(id, notes);
            router.refresh();
          })}
        >
          {t("saveNotes")}
        </button>
      </div>
    </div>
  );
}
