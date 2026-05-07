import Link from "next/link";
import { redirect } from "next/navigation";

import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
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

  const totals = await prisma.complaint.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const totalAll = totals.reduce((acc, t) => acc + t._count._all, 0);
  const statusMap = Object.fromEntries(totals.map((t) => [t.status, t._count._all] as const));
  const escalated = await prisma.escalationLog.count();

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
        <StatCard label="Total complaints" value={totalAll} />
        <StatCard label="Pending/Assigned" value={(statusMap.ASSIGNED ?? 0) + (statusMap.SUBMITTED ?? 0)} />
        <StatCard label="Resolved" value={statusMap.RESOLVED ?? 0} />
        <StatCard label="Escalations" value={escalated} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
          <div className="text-sm font-medium">Status snapshot</div>
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
        </div>

        <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
          <div className="text-sm font-medium">Quick links</div>
          <div className="mt-3 grid gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/smart-queue">Open AI-prioritized queue</Link>
            </Button>
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
  );
}

