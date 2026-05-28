import Link from "next/link";
import { redirect } from "next/navigation";

import { SlaBadge } from "@/components/dashboard/SlaBadge";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

function StatusChart({ data }: { data: Array<{ name: string; value: number }> }) {
  "use client";
  // Lightweight chart to avoid overbuilding; Recharts is installed for later enhancement.
  return (
    <div className="grid gap-2">
      {data.map((d) => (
        <div
          key={d.name}
          className="flex items-center justify-between rounded-md border bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur"
        >
          <span className="text-muted-foreground">{d.name}</span>
          <span className="font-medium">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/worker/dashboard");

  const now = new Date();
  const soon6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totals = await prisma.complaint.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const totalAll = totals.reduce((acc, t) => acc + t._count._all, 0);
  const statusMap = Object.fromEntries(totals.map((t) => [t.status, t._count._all] as const));

  const [escalatedAll, escalated24h] = await Promise.all([
    prisma.escalationLog.count(),
    prisma.escalationLog.count({ where: { triggeredAt: { gte: dayAgo } } }),
  ]);

  const [overdueCount, dueSoonCount, unassignedCount] = await Promise.all([
    prisma.complaint.count({
      where: { status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] }, slaDueAt: { lt: now } },
    }),
    prisma.complaint.count({
      where: { status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] }, slaDueAt: { gte: now, lte: soon6h } },
    }),
    prisma.complaint.count({
      where: { status: { in: ["SUBMITTED", "ASSIGNED"] }, assignedWorkerId: null },
    }),
  ]);

  const riskiest = await prisma.complaint.findMany({
    where: { status: { in: ["SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] } },
    orderBy: [{ slaDueAt: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    take: 12,
    include: { agency: true, assignedWorker: { select: { email: true } } },
  });

  // TiDB adapter + groupBy ordering can be finicky; compute backlog via counts per agency.
  const backlogRows = await prisma.complaint.findMany({
    where: { status: { in: ["SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] } },
    select: { agencyId: true },
    take: 2000,
  });
  const backlogMap = new Map<string | null, number>();
  for (const r of backlogRows) backlogMap.set(r.agencyId, (backlogMap.get(r.agencyId) ?? 0) + 1);
  const agencyBacklogSorted = [...backlogMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([agencyId, count]) => ({ agencyId, count }));
  const agencyIds = agencyBacklogSorted.map((a) => a.agencyId).filter((x): x is string => !!x);
  const agencies = agencyIds.length
    ? await prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true, code: true } })
    : [];
  const agencyNameById = new Map(agencies.map((a) => [a.id, `${a.name} (${a.code})`] as const));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Admin dashboard</div>
          <div className="text-sm text-muted-foreground">Monitor the system. Override only when needed.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/smart-queue">Smart queue</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/monitoring">Monitoring</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Overdue (active)" value={overdueCount} hint="ASSIGNED/ACCEPTED/IN_PROGRESS past SLA." />
        <StatCard label="Due in <6h" value={dueSoonCount} hint="High risk within next 6 hours." />
        <StatCard label="Unassigned" value={unassignedCount} hint="No worker assigned yet." />
        <StatCard label="Escalations (24h)" value={escalated24h} hint={`Total escalations: ${escalatedAll}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Highest risk right now</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Sorted by earliest SLA due. Use this list for rapid intervention.
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/smart-queue">Open queue</Link>
            </Button>
          </div>
          <div className="mt-3 divide-y">
            {riskiest.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No active complaints.</div>
            ) : (
              riskiest.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{c.trackingId}</span>
                      <StatusBadge status={c.status} />
                      <PriorityBadge priority={c.priority} />
                      <SlaBadge slaDueAt={c.slaDueAt ?? null} />
                      <span className="text-xs text-muted-foreground">
                        {c.agency?.name ?? "Agency pending"} · {c.assignedWorker?.email ?? "Unassigned"}
                      </span>
                    </div>
                    {c.locationText?.trim() ? (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        Location: <span className="font-medium text-foreground/80">{c.locationText}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-10">
                      <Link href={`/track?trackingId=${encodeURIComponent(c.trackingId)}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold">Agency bottlenecks</div>
            <div className="mt-1 text-xs text-muted-foreground">Top backlogs across active complaints.</div>
            <div className="mt-3 grid gap-2">
              {agencyBacklogSorted.length === 0 ? (
                <div className="text-sm text-muted-foreground">No backlog data.</div>
              ) : (
                agencyBacklogSorted.map((a) => (
                  <div
                    key={a.agencyId ?? "none"}
                    className="flex items-center justify-between rounded-xl border bg-white/70 px-3 py-2 text-sm shadow-sm"
                  >
                    <span className="text-muted-foreground">
                      {a.agencyId ? (agencyNameById.get(a.agencyId) ?? "Unknown agency") : "Unrouted / Pending"}
                    </span>
                    <span className="font-medium">{a.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold">System snapshot</div>
            <div className="mt-3">
              <StatusChart
                data={[
                  { name: "SUBMITTED", value: statusMap.SUBMITTED ?? 0 },
                  { name: "ASSIGNED", value: statusMap.ASSIGNED ?? 0 },
                  { name: "ACCEPTED", value: statusMap.ACCEPTED ?? 0 },
                  { name: "IN_PROGRESS", value: statusMap.IN_PROGRESS ?? 0 },
                  { name: "RESOLVED", value: statusMap.RESOLVED ?? 0 },
                  { name: "CLOSED", value: statusMap.CLOSED ?? 0 },
                ]}
              />
            </div>

            <div className="mt-4 grid gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/monitoring">View SLA warnings and escalations</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Public landing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total complaints" value={totalAll} />
        <StatCard label="Pending/Assigned" value={(statusMap.ASSIGNED ?? 0) + (statusMap.SUBMITTED ?? 0)} />
        <StatCard label="Resolved" value={statusMap.RESOLVED ?? 0} />
        <StatCard label="Closed" value={statusMap.CLOSED ?? 0} />
      </div>
    </div>
  );
}

