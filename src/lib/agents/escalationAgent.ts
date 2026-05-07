import { prisma } from "@/lib/db/prisma";

export async function escalationAgent(input: { complaintId: string; reason: string }) {
  await prisma.escalationLog.create({
    data: {
      complaintId: input.complaintId,
      level: "WARNING",
      reason: input.reason,
    },
  });
  await prisma.complaint.update({
    where: { id: input.complaintId },
    data: { lastEscalatedAt: new Date() },
  });
  await prisma.actionLog.create({
    data: {
      complaintId: input.complaintId,
      actorType: "SYSTEM",
      eventType: "ESCALATED",
      message: input.reason,
    },
  });
}

