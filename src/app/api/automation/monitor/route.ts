import { NextResponse } from "next/server";

import { escalationAgent } from "@/lib/agents/escalationAgent";
import { monitoringAgent } from "@/lib/agents/monitoringAgent";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const result = await monitoringAgent();
  const now = new Date();

  // Escalate overdue (simple hackathon rule: once per 2 hours max).
  for (const c of result.overdue) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: c.id },
      select: { lastEscalatedAt: true, status: true },
    });
    if (!complaint) continue;
    if (complaint.status === "CLOSED") continue;
    const last = complaint.lastEscalatedAt?.getTime() ?? 0;
    if (now.getTime() - last < 2 * 60 * 60 * 1000) continue;
    await escalationAgent({ complaintId: c.id, reason: "SLA overdue. Auto-escalated by system." });
  }

  // Auto-close resolved complaints after 12 hours (demo behavior).
  const toClose = await prisma.complaint.findMany({
    where: { status: "RESOLVED", updatedAt: { lt: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
    select: { id: true },
    take: 200,
  });
  for (const c of toClose) {
    await prisma.complaint.update({
      where: { id: c.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await prisma.actionLog.create({
      data: {
        complaintId: c.id,
        actorType: "SYSTEM",
        eventType: "AUTO_CLOSED",
        message: "Auto-closed after resolution timeout.",
      },
    });
  }

  // Create warning logs for complaints nearing SLA.
  const dueSoon = await prisma.complaint.findMany({
    where: {
      status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] },
      slaDueAt: { gt: now, lt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
    },
    select: { id: true, trackingId: true, slaDueAt: true },
    take: 200,
  });
  for (const c of dueSoon) {
    await prisma.actionLog.create({
      data: {
        complaintId: c.id,
        actorType: "SYSTEM",
        eventType: "SLA_WARNING",
        message: `SLA due soon (${c.slaDueAt?.toISOString()}).`,
      },
    });
  }

  return NextResponse.json({ ...result, autoClosed: toClose.length, dueSoon: dueSoon.length });
}

