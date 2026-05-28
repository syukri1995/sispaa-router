import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { SlaBadge } from "@/components/dashboard/SlaBadge";
import { StatCard } from "@/components/dashboard/StatCard";
import { NextActionButton } from "@/components/dashboard/NextActionButton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

function riskScore(c: {
  priority: string;
  status: string;
  slaDueAt: Date | null;
}) {
  const priorityWeight =
    c.priority === "Critical" ? 80 : c.priority === "High" ? 55 : c.priority === "Medium" ? 30 : 15;
  const statusWeight = c.status === "ASSIGNED" ? 30 : c.status === "ACCEPTED" ? 25 : c.status === "IN_PROGRESS" ? 20 : 5;
  const now = Date.now();
  const due = c.slaDueAt?.getTime() ?? null;
  const slaWeight =
    due === null
      ? 0
      : due < now
        ? 120
        : due - now < 60 * 60 * 1000
          ? 70
          : due - now < 6 * 60 * 60 * 1000
            ? 40
            : due - now < 24 * 60 * 60 * 1000
              ? 20
              : 5;
  return priorityWeight + statusWeight + slaWeight;
}

function nextActionLabel(status: string) {
  if (status === "ASSIGNED") return "Accept";
  if (status === "ACCEPTED") return "Start";
  if (status === "IN_PROGRESS") return "Resolve";
  return null;
}

function nextActionType(status: string) {
  if (status === "ASSIGNED") return "ACCEPT";
  if (status === "ACCEPTED") return "START";
  if (status === "IN_PROGRESS") return "RESOLVE";
  return null;
}

export default async function WorkerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin/dashboard");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();

  const complaints = await prisma.complaint.findMany({
    where: {
      assignedWorkerId: session.sub,
      status: statusFilter
        ? (statusFilter as "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED")
        : { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RESOLVED"] },
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { trackingId: { contains: q } },
              { locationText: { contains: q } },
            ],
          }
        : {}),
    },
    take: 50,
    select: {
      id: true,
      trackingId: true,
      title: true,
      status: true,
      priority: true,
      slaDueAt: true,
      locationText: true,
      gpsLat: true,
      gpsLng: true,
      createdAt: true,
    },
  });

  const sorted = [...complaints].sort((a, b) => {
    const r = riskScore({ priority: a.priority, status: a.status, slaDueAt: a.slaDueAt }) - riskScore({ priority: b.priority, status: b.status, slaDueAt: b.slaDueAt });
    if (r !== 0) return -r;
    return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
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
          <div>
            <div className="text-sm font-semibold">Your work queue</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Sorted by SLA risk first. Use quick actions to avoid opening each job.
            </div>
          </div>
        </div>

        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search tracking ID, title, location…"
            className="h-10 flex-1 rounded-xl border bg-white px-3 text-sm shadow-sm"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-10 rounded-xl border bg-white px-3 text-sm shadow-sm"
          >
            <option value="">All</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
          <Button type="submit" size="sm" className="h-10">
            Filter
          </Button>
        </form>

        <div className="mt-3 divide-y">
          {sorted.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">No assigned complaints.</div>
          ) : (
            sorted.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  {c.locationText?.trim() ? (
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      Location: <span className="font-medium text-foreground/80">{c.locationText}</span>
                    </div>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.trackingId}</span>
                    <StatusBadge status={c.status} />
                    <PriorityBadge priority={c.priority} />
                    <SlaBadge slaDueAt={c.slaDueAt ?? null} />
                    {typeof c.gpsLat === "number" && typeof c.gpsLng === "number" ? (
                      <span className="text-xs text-muted-foreground">
                        GPS:{" "}
                        <span className="font-medium text-foreground">
                          {c.gpsLat.toFixed(4)}, {c.gpsLng.toFixed(4)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(c.priority === "High" || c.priority === "Critical") && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Urgent
                    </div>
                  )}
                  <NextActionButton complaintId={c.id} status={c.status} />
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

