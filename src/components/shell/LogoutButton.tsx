"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-medium text-[color:var(--gov-text)] shadow-sm transition hover:bg-[color:var(--gov-gray-50)] disabled:opacity-60"
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4 text-[color:var(--gov-blue)]" />
      {pending ? "Signing out..." : "Logout"}
    </button>
  );
}

