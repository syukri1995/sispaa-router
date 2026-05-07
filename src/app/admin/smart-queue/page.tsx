import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SlaBadge } from "@/components/dashboard/SlaBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

function priorityScore(p: string) {
  return p === "Critical" ? 4 : p === "High" ? 3 : p === "Medium" ? 2 : 1;
}

export default async function SmartQueuePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/worker/dashboard");

  const complaints = await prisma.complaint.findMany({
    include: { agency: true, assignedWorker: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const sorted = [...complaints].sort((a, b) => {
    const aDue = a.slaDueAt ? a.slaDueAt.getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.slaDueAt ? b.slaDueAt.getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return priorityScore(b.priority) - priorityScore(a.priority);
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Smart queue"
        description="AI-prioritized queue (priority + SLA urgency)."
        actions={[{ label: "Back", href: "/admin/dashboard", variant: "outline" }]}
      />

      <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="divide-y">
          {sorted.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">No complaints in queue.</div>
          ) : (
            sorted.map((c) => {
              return (
                <div key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                  </div>
                  <div className="flex items-center gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/track?trackingId=${encodeURIComponent(c.trackingId)}`}>View</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

