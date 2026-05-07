import { AIDecisionTimeline } from "@/components/timeline/AIDecisionTimeline";
import { StatusTimeline } from "@/components/timeline/StatusTimeline";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { prisma } from "@/lib/db/prisma";
import { TrackForm } from "@/app/track/TrackForm";

export default async function TrackComplaintPage({
  searchParams,
}: {
  searchParams: Promise<{ trackingId?: string }>;
}) {
  const { trackingId } = await searchParams;
  const id = (trackingId ?? "").trim();

  const complaint = id
    ? await prisma.complaint.findUnique({
        where: { trackingId: id },
        include: {
          agency: true,
          actionLogs: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Track complaint"
        description="Enter your tracking ID to view status, routing, and AI decision timeline."
        actions={[{ label: "Submit", href: "/submit", variant: "outline" }]}
      />

      <div className="mt-6 rounded-2xl border bg-white/70 p-6 shadow-lg backdrop-blur">
        <TrackForm initial={id} />

        {complaint ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-muted-foreground">{complaint.trackingId}</div>
                <div className="mt-1 text-xl font-semibold">{complaint.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">{complaint.description}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                  {complaint.slaDueAt ? (
                    <span className="text-xs text-muted-foreground">
                      Estimated due:{" "}
                      <span className="font-medium text-foreground">{complaint.slaDueAt.toISOString()}</span>
                    </span>
                  ) : null}
                </div>
                {complaint.aiSummary ? (
                  <div className="mt-3 rounded-xl border bg-zinc-50 p-3">
                    <div className="text-xs font-medium text-muted-foreground">AI summary</div>
                    <div className="mt-1 text-sm">{complaint.aiSummary}</div>
                  </div>
                ) : null}
              </div>

              {Array.isArray(complaint.imageUrls) && complaint.imageUrls[0] ? (
                <div className="rounded-2xl border p-4">
                  <div className="text-sm font-medium">Evidence</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Image stored privately in Vercel Blob (URL may require access policy).
                  </div>
                  <div className="mt-2 break-all text-xs">{String(complaint.imageUrls[0])}</div>
                </div>
              ) : null}

              <AIDecisionTimeline
                logs={complaint.actionLogs.map((l) => ({
                  ...l,
                  createdAt: l.createdAt,
                }))}
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
                <div className="text-sm font-semibold">Routing</div>
                <div className="mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Agency:</span>{" "}
                    <span className="font-medium">{complaint.agency?.name ?? "Pending"}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <span className="font-medium">{complaint.category ?? "Pending"}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-muted-foreground">Priority:</span>{" "}
                    <span className="font-medium">{complaint.priority}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
                <StatusTimeline status={complaint.status} />
              </div>
            </div>
          </div>
        ) : id ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Not found: invalid tracking ID
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">Enter a tracking ID to view your complaint.</div>
        )}
      </div>
    </div>
  );
}

