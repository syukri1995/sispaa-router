import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { SlaBadge } from "@/components/dashboard/SlaBadge";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export default async function WorkerDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin/dashboard");

  const complaints = await prisma.complaint.findMany({
    where: { assignedWorkerId: session.sub, status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RESOLVED"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const assigned = complaints.filter((c) => c.status === "ASSIGNED").length;
  const inProgress = complaints.filter((c) => c.status === "IN_PROGRESS").length;
  const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
  const urgent = complaints.filter((c) => c.priority === "High" || c.priority === "Critical").length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Worker dashboard"
        description="Minimal actions: Accept job → Start work → Mark resolved."
        actions={[{ label: "Public home", href: "/", variant: "outline" }]}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Assigned" value={assigned} />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Urgent (High/Critical)" value={urgent} hint="Prioritize SLA-risk jobs." />
      </div>

      <div className="mt-6 rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Assigned jobs</div>
          <div className="text-xs text-muted-foreground">Tap a job to take action.</div>
        </div>
        <div className="mt-3 divide-y">
          {complaints.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">No assigned complaints.</div>
          ) : (
            complaints.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.trackingId}</span>
                    <StatusBadge status={c.status} />
                    <PriorityBadge priority={c.priority} />
                    <SlaBadge slaDueAt={c.slaDueAt ?? null} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(c.priority === "High" || c.priority === "Critical") && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Urgent
                    </div>
                  )}
                  <Button asChild size="sm" className="h-11 px-4">
                    <Link href={`/worker/complaints/${c.id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
        <div className="text-sm font-semibold">Resolved today</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {resolved} resolved complaints are awaiting system auto-close (demo behavior).
        </div>
      </div>
    </div>
  );
}

