import { redirect } from "next/navigation";

import { AIDecisionTimeline } from "@/components/timeline/AIDecisionTimeline";
import { StatusTimeline } from "@/components/timeline/StatusTimeline";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getSession } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { ActionButtons } from "@/app/worker/complaints/[id]/ActionButtons";
import { WorkerEvidencePanel } from "@/app/worker/complaints/[id]/WorkerEvidencePanel";

export default async function WorkerComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin/dashboard");

  const { id } = await params;
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { agency: true, actionLogs: { orderBy: { createdAt: "asc" } } },
  });
  if (!complaint) redirect("/worker/dashboard");
  if (complaint.assignedWorkerId !== session.sub) redirect("/worker/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Complaint detail"
        description={complaint.trackingId}
        actions={[{ label: "Back to dashboard", href: "/worker/dashboard", variant: "outline" }]}
      />

      <div className="mt-6 rounded-2xl border bg-white/70 p-5 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold tracking-tight">{complaint.title}</div>
            <div className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{complaint.description}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />
              <span className="text-xs text-muted-foreground">
                Agency: <span className="font-medium text-foreground">{complaint.agency?.name ?? "Pending"}</span>
              </span>
            </div>
          </div>
          <div className="sm:pt-1">
            <Button asChild variant="outline" size="sm">
              <a href={`/track?trackingId=${encodeURIComponent(complaint.trackingId)}`}>Public view</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold">Worker actions</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Keep actions minimal. The system handles routing and monitoring automatically.
            </div>
            <div className="mt-3">
              <ActionButtons complaintId={complaint.id} status={complaint.status} />
            </div>
          </div>

          {complaint.status === "ACCEPTED" || complaint.status === "IN_PROGRESS" ? (
            <WorkerEvidencePanel complaintId={complaint.id} />
          ) : null}

          <AIDecisionTimeline
            logs={complaint.actionLogs.map((l) => ({
              ...l,
              createdAt: l.createdAt,
            }))}
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
            <StatusTimeline status={complaint.status} />
          </div>
          <div className="rounded-2xl border bg-white/70 p-4 shadow-lg backdrop-blur">
            <div className="text-sm font-semibold">Routing</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Agency: <span className="font-medium text-foreground">{complaint.agency?.name ?? "Pending"}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Category: <span className="font-medium text-foreground">{complaint.category ?? "Pending"}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Priority: <span className="font-medium text-foreground">{complaint.priority}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

