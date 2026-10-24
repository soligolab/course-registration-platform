"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { addAdmin, removeAdmin, type FormState } from "@/app/actions/admin";

type Admin = { id: string; email: string; name: string; pending: boolean };

export function AdminsManager({ admins, currentId }: { admins: Admin[]; currentId: string }) {
  const t = useTranslations("admin.admins");
  const router = useRouter();
  const [state, action, adding] = useActionState<FormState, FormData>(addAdmin, {});
  const [removing, start] = useTransition();

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              <span className="font-medium">{a.name || a.email}</span>
              {a.name && <span className="text-slate-500"> · {a.email}</span>}
              {a.pending && <span className="badge ml-2 bg-amber-100 text-amber-700">{t("pending")}</span>}
            </span>
            {a.id === currentId ? (
              <span className="text-slate-400">{t("you")}</span>
            ) : (
              <button
                type="button"
                className="text-red-600 hover:underline disabled:opacity-50"
                disabled={removing}
                onClick={() =>
                  confirm(t("removeConfirm", { email: a.email })) &&
                  start(async () => {
                    await removeAdmin(a.id);
                    router.refresh();
                  })
                }
              >
                {t("remove")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="grow">
          <label htmlFor="admin-email" className="label">
            {t("email")}
          </label>
          <input id="admin-email" name="email" type="email" required className={`input ${state.errors ? "input-error" : ""}`} />
        </div>
        <button className="btn-primary" disabled={adding}>
          {t("add")}
        </button>
      </form>
      <p className="text-xs text-slate-500">{t("hint")}</p>
      {state.ok && <p className="text-sm text-emerald-700">{t("added")}</p>}
    </div>
  );
}
