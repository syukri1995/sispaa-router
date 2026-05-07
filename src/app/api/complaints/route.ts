import { NextResponse } from "next/server";

import { classificationAgent } from "@/lib/agents/classificationAgent";
import { intakeAgent } from "@/lib/agents/intakeAgent";
import { priorityAgent } from "@/lib/agents/priorityAgent";
import { routingAgent } from "@/lib/agents/routingAgent";
import { workforceAgent } from "@/lib/agents/workforceAgent";
import { requireRole } from "@/lib/auth/middleware";
import { computeSlaDueAt } from "@/lib/constants/sla";
import { prisma } from "@/lib/db/prisma";
import { ComplaintPriority } from "@/generated/prisma/enums";

function makeTrackingId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "SIS-";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { title?: string; description?: string; imageUrls?: string[] }
    | null;
  const title = body?.title?.trim();
  const description = body?.description?.trim();
  const imageUrls = Array.isArray(body?.imageUrls) ? body?.imageUrls : [];

  if (!title || !description) {
    return NextResponse.json({ error: "missing_title_or_description" }, { status: 400 });
  }

  const trackingId = makeTrackingId();

  const intake = await intakeAgent({ title, description });
  const classification = await classificationAgent({ title, description });
  const priority = await priorityAgent({ title, description });
  const routing = await routingAgent({
    category: classification.data.category,
    intent: intake.data.intent,
  });

  const agency =
    routing.data.agency === "JKR"
      ? await prisma.agency.findUnique({ where: { code: "JKR" } })
      : routing.data.agency === "Transport Ministry"
        ? await prisma.agency.findUnique({ where: { code: "MOT" } })
        : await prisma.agency.findUnique({ where: { code: "COUNCIL" } });

  const priorityEnum =
    priority.data.priority === "Critical"
      ? ComplaintPriority.Critical
      : priority.data.priority === "High"
        ? ComplaintPriority.High
        : priority.data.priority === "Low"
          ? ComplaintPriority.Low
          : ComplaintPriority.Medium;
  const slaDueAt = computeSlaDueAt(priorityEnum);

  const created = await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.create({
      data: {
        trackingId,
        title,
        description,
        imageUrls,
        category: classification.data.category,
        priority: priorityEnum,
        status: "SUBMITTED",
        agencyId: agency?.id ?? null,
        aiSummary: intake.data.summary,
        aiReasoning: JSON.stringify({
          intake: intake.ok ? null : intake.error,
          classification: classification.ok ? null : classification.error,
          priority: priority.ok ? null : priority.error,
          routing: routing.ok ? null : routing.error,
          reasons: {
            classification: classification.data.reason,
            priority: priority.data.reason,
            routing: routing.data.reason,
          },
        }),
        slaDueAt,
      },
    });

    await tx.actionLog.createMany({
      data: [
        {
          complaintId: complaint.id,
          actorType: "SYSTEM",
          eventType: "SUBMITTED",
          message: "Complaint submitted.",
        },
        {
          complaintId: complaint.id,
          actorType: "AI",
          eventType: "AI_INTAKE",
          message: "AI extracted intent and summary.",
          metadata: intake.data,
        },
        {
          complaintId: complaint.id,
          actorType: "AI",
          eventType: "AI_CLASSIFIED",
          message: "AI classified complaint category.",
          metadata: classification.data,
        },
        {
          complaintId: complaint.id,
          actorType: "AI",
          eventType: "AI_PRIORITIZED",
          message: "AI determined urgency priority.",
          metadata: priority.data,
        },
        {
          complaintId: complaint.id,
          actorType: "AI",
          eventType: "AI_ROUTED",
          message: "AI selected agency.",
          metadata: routing.data,
        },
      ],
    });

    if (agency?.id) {
      const wf = await workforceAgent({ agencyId: agency.id, category: complaint.category });
      if (wf.ok && wf.workerId) {
        await tx.complaint.update({
          where: { id: complaint.id },
          data: {
            assignedWorkerId: wf.workerId,
            status: "ASSIGNED",
          },
        });
        await tx.assignment.create({
          data: { complaintId: complaint.id, workerId: wf.workerId, status: "ASSIGNED" },
        });
        await tx.worker.update({
          where: { id: wf.workerId },
          data: { currentWorkload: { increment: 1 } },
        });
        await tx.actionLog.create({
          data: {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_ASSIGNED",
            message: "AI assigned best available worker.",
            metadata: wf,
          },
        });
      } else {
        await tx.actionLog.create({
          data: {
            complaintId: complaint.id,
            actorType: "SYSTEM",
            eventType: "UNASSIGNED",
            message: wf.reason,
          },
        });
      }
    }

    return complaint;
  });

  return NextResponse.json({ ok: true, trackingId: created.trackingId });
}

export async function GET() {
  const auth = await requireRole(["ADMIN", "WORKER"]);
  if (!auth.ok) return auth.response;
  const complaints = await prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { agency: true, assignedWorker: true },
  });
  return NextResponse.json({ ok: true, complaints });
}

