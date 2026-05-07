import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SlaBadge } from "@/components/dashboard/SlaBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export default async function MonitoringPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/worker/dashboard");

  const now = new Date();
  const overdue = await prisma.complaint.findMany({
    where: {
      status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
      slaDueAt: { lt: now },
    },
    orderBy: { slaDueAt: "asc" },
    take: 100,
  });

  const escalations = await prisma.escalationLog.findMany({
    orderBy: { triggeredAt: "desc" },
    take: 50,
    include: { complaint: true },
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">System monitoring</div>
          <div className="text-sm text-muted-foreground">SLA warnings, overdue detection, and escalation logs.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/dashboard">Back</Link>
          </Button>
          <Button asChild>
            <a href="/api/automation/monitor">Run monitor now</a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-medium">Overdue complaints</div>
          <div className="mt-3 divide-y">
            {overdue.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No overdue complaints.</div>
            ) : (
              overdue.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.trackingId} · {c.priority} · due {c.slaDueAt?.toISOString()}
                  </div>
                  </div>
                  <SlaBadge slaDueAt={c.slaDueAt ?? null} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-medium">Escalation logs</div>
          <div className="mt-3 divide-y">
            {escalations.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No escalations yet.</div>
            ) : (
              escalations.map((e) => (
                <div key={e.id} className="py-3">
                  <div className="text-sm font-medium">{e.complaint.trackingId}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.level} · {e.triggeredAt.toISOString()}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{e.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

