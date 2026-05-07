"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <div className="rounded-2xl border bg-white/70 p-6 shadow-lg backdrop-blur">
        <div className="space-y-2">
          <div className="text-2xl font-semibold tracking-tight">Worker / Admin login</div>
          <div className="text-sm text-muted-foreground">
            For demo seeding, use <span className="font-medium">admin@sispaa.local</span> /{" "}
            <span className="font-medium">admin1234</span> or{" "}
            <span className="font-medium">worker.jkr@sispaa.local</span> /{" "}
            <span className="font-medium">worker1234</span>.
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email") ?? "");
            const password = String(form.get("password") ?? "");
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const data = (await res.json().catch(() => null)) as unknown;
            if (!res.ok) {
              const err =
                typeof data === "object" &&
                data !== null &&
                "error" in data &&
                typeof (data as Record<string, unknown>).error === "string"
                  ? ((data as Record<string, unknown>).error as string)
                  : "login_failed";
              setError(err);
              return;
            }
            const role =
              typeof data === "object" && data && "worker" in data
                ? (((data as Record<string, unknown>).worker as Record<string, unknown> | undefined)?.role as
                    | "ADMIN"
                    | "WORKER"
                    | undefined)
                : undefined;
            if (role === "ADMIN") router.push("/admin/dashboard");
            else router.push("/worker/dashboard");
            router.refresh();
          } finally {
            setPending(false);
          }
        }}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="you@agency.gov.my"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              required
            />
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Sign-in failed: {error}
            </div>
          ) : null}
          <Button type="submit" className="w-full">
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}

