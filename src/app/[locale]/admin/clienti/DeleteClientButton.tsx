"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { deleteClient } from "@/app/actions/admin";

export function DeleteClientButton({ id, label, confirmText }: { id: string; label: string; confirmText: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-red-600 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        confirm(confirmText) &&
        start(async () => {
          await deleteClient(id);
          router.refresh();
        })
      }
    >
      {label}
    </button>
  );
}
