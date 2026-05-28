import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/shell/LogoutButton";

export function GovHeader(props: {
  role: "PUBLIC" | "WORKER" | "ADMIN";
  userLabel?: string | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logos/gov-emblem.svg"
              alt="Government emblem"
              width={36}
              height={36}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-[color:var(--gov-text)] sm:text-base">
                SISPAA Intelligent GovTech Router
              </div>
              <div className="truncate text-xs text-muted-foreground">
                AI-powered complaint orchestration for faster public service delivery
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
          {props.role === "PUBLIC" ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/submit">Submit complaint</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/track">Track</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">Staff / Worker</Link>
              </Button>
            </>
          ) : props.role === "ADMIN" ? (
            <>
              <Button asChild size="sm">
                <Link href="/admin/dashboard">Admin dashboard</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/smart-queue">Smart queue</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/monitoring">Monitoring</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm">
                <Link href="/worker/dashboard">Worker dashboard</Link>
              </Button>
            </>
          )}
          </nav>

          <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border bg-white/70 px-3 py-2 text-xs font-medium text-[color:var(--gov-text)] shadow-sm backdrop-blur transition hover:bg-white/80"
            aria-label="Switch language"
          >
            <Globe className="h-4 w-4 text-[color:var(--gov-blue)]" />
            BM / EN
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white/70 shadow-sm backdrop-blur transition hover:bg-white/80"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-[color:var(--gov-blue)]" />
          </button>
          {props.role === "PUBLIC" ? null : <LogoutButton />}
          <div className="hidden items-center gap-2 rounded-xl border bg-white/70 px-3 py-2 text-xs shadow-sm backdrop-blur sm:flex">
            <span className="font-medium">{props.userLabel ?? "Public"}</span>
            <span className="text-muted-foreground">{props.role}</span>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="mt-2 grid gap-2 border-t px-4 py-3 md:hidden sm:px-6">
        {props.role === "PUBLIC" ? (
          <div className="grid grid-cols-3 gap-2">
            <Button asChild variant="outline" size="sm" className="h-10">
              <Link href="/submit">Submit</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-10">
              <Link href="/track">Track</Link>
            </Button>
            <Button asChild size="sm" className="h-10">
              <Link href="/login">Staff</Link>
            </Button>
          </div>
        ) : props.role === "ADMIN" ? (
          <div className="grid grid-cols-3 gap-2">
            <Button asChild size="sm" className="h-10">
              <Link href="/admin/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-10">
              <Link href="/admin/smart-queue">Queue</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-10">
              <Link href="/admin/monitoring">SLA</Link>
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" className="h-10">
            <Link href="/worker/dashboard">Worker dashboard</Link>
          </Button>
        )}
      </div>
      </div>
    </header>
  );
}

