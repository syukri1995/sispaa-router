import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-sm shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-[color:var(--gov-blue)]" />
            <span className="font-medium">AI-powered public service</span>
            <span className="text-muted-foreground">intake → routing → workforce → SLA</span>
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--gov-text)] md:text-5xl">
            AI-Powered Public Complaint Coordination
          </h1>
          <p className="text-lg leading-7 text-muted-foreground">
            A modern Malaysian government-style orchestration platform that automatically classifies complaints,
            routes them to the right agency, assigns the best worker, and monitors SLA—reducing bureaucracy through
            automation.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/submit" className="inline-flex items-center gap-2">
                Submit complaint <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/track">Track complaint</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-blue-50 p-2 text-[color:var(--gov-blue)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Agency routing</div>
                  <div className="text-xs text-muted-foreground">JKR / Council / Transport</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-red-50 p-2 text-[color:var(--gov-red)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">Audit-friendly AI</div>
                  <div className="text-xs text-muted-foreground">Decision timeline & reasons</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-orange-50 p-2 text-[color:var(--gov-warning)]">
                  <Timer className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">SLA monitoring</div>
                  <div className="text-xs text-muted-foreground">Warnings & escalation</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
          <Image
            src="/images/hero-infra.svg"
            alt="Public infrastructure and service coordination"
            width={1200}
            height={680}
            className="h-auto w-full rounded-xl"
            priority
          />
        </div>
      </div>
    </div>
  );
}
