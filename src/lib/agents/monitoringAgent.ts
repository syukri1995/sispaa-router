import { prisma } from "@/lib/db/prisma";

export async function monitoringAgent() {
  const now = new Date();
  const open = await prisma.complaint.findMany({
    where: { status: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RESOLVED"] } },
    select: { id: true, trackingId: true, priority: true, status: true, slaDueAt: true },
    take: 500,
  });

  const overdue = open.filter((c) => c.slaDueAt && c.slaDueAt.getTime() < now.getTime());
  return { ok: true as const, totalOpen: open.length, overdue };
}

