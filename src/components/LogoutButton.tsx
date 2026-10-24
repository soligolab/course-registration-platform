"use client";

import { useRouter } from "@/i18n/routing";
import { logout } from "@/app/actions/auth";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="opacity-85 hover:opacity-100"
      onClick={async () => {
        await logout();
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
