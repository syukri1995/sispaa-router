import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/middleware";
import { resolutionAgent } from "@/lib/agents/resolutionAgent";
import { prisma } from "@/lib/db/prisma";

type Action = "ACCEPT" | "START" | "RESOLVE";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["WORKER", "ADMIN"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { action?: Action } | null;
  const action = body?.action;
  if (!action) return NextResponse.json({ error: "missing_action" }, { status: 400 });

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (complaint.assignedWorkerId !== auth.session.sub && auth.session.role !== "ADMIN") {
    return NextResponse.json({ error: "not_assigned_to_you" }, { status: 403 });
  }

  const now = new Date();

  if (action === "RESOLVE") {
    if (complaint.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    }

    const evidenceLog = await prisma.actionLog.findFirst({
      where: { complaintId: id, eventType: "WORK_EVIDENCE", workerId: auth.session.sub },
      orderBy: { createdAt: "desc" },
    });
    const meta = (evidenceLog?.metadata ?? null) as unknown;
    const evidenceUrls =
      typeof meta === "object" && meta !== null && "imageUrls" in meta && Array.isArray((meta as { imageUrls?: unknown }).imageUrls)
        ? ((meta as { imageUrls: unknown[] }).imageUrls).filter((u) => typeof u === "string") as string[]
        : [];
    const workerNote =
      typeof meta === "object" && meta !== null && "note" in meta && typeof (meta as { note?: unknown }).note === "string"
        ? ((meta as { note: string }).note as string)
        : "";

    if (evidenceUrls.length === 0) {
      return NextResponse.json({ error: "evidence_required" }, { status: 409 });
    }

    const ai = await resolutionAgent({
      title: complaint.title,
      description: complaint.description,
      workerNote,
      evidenceUrls,
    });

    if (!ai.data.resolved) {
      await prisma.actionLog.create({
        data: {
          complaintId: id,
          workerId: auth.session.sub,
          actorType: "AI",
          eventType: "AI_RESOLUTION_REJECTED",
          message: "AI rejected resolution due to insufficient evidence.",
          metadata: ai.data,
        },
      });
      return NextResponse.json(
        { error: "ai_not_confident", reason: ai.data.reason, missing: ai.data.missing },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (action === "ACCEPT") {
      if (complaint.status !== "ASSIGNED")
        return NextResponse.json({ error: "invalid_state" }, { status: 409 });
      await tx.complaint.update({ where: { id }, data: { status: "ACCEPTED" } });
      await tx.assignment.updateMany({
        where: { complaintId: id, status: "ASSIGNED" },
        data: { status: "ACCEPTED", acceptedAt: now },
      });
      await tx.actionLog.create({
        data: {
          complaintId: id,
          workerId: auth.session.sub,
          actorType: auth.session.role,
          eventType: "ACCEPTED",
          message: "Worker accepted the job.",
        },
      });
      return null;
    }

    if (action === "START") {
      if (complaint.status !== "ACCEPTED")
        return NextResponse.json({ error: "invalid_state" }, { status: 409 });
      await tx.complaint.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      await tx.assignment.updateMany({
        where: { complaintId: id, status: "ACCEPTED" },
        data: { status: "IN_PROGRESS", startedAt: now },
      });
      await tx.actionLog.create({
        data: {
          complaintId: id,
          workerId: auth.session.sub,
          actorType: auth.session.role,
          eventType: "IN_PROGRESS",
          message: "Worker started work.",
        },
      });
      return null;
    }

    if (action === "RESOLVE") {
      await tx.complaint.update({ where: { id }, data: { status: "RESOLVED" } });
      await tx.assignment.updateMany({
        where: { complaintId: id, status: "IN_PROGRESS" },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      await tx.actionLog.create({
        data: {
          complaintId: id,
          workerId: auth.session.sub,
          actorType: auth.session.role,
          eventType: "RESOLVED",
          message: "Worker marked as resolved.",
          metadata: { verifiedByAI: true },
        },
      });
      return null;
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  });

  if (updated) return updated;
  return NextResponse.json({ ok: true });
}

