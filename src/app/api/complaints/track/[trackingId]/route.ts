import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const complaint = await prisma.complaint.findUnique({
    where: { trackingId },
    include: {
      agency: true,
      assignedWorker: { select: { id: true, email: true } },
      actionLogs: { orderBy: { createdAt: "asc" } },
      escalationLogs: { orderBy: { triggeredAt: "desc" } },
    },
  });

  if (!complaint) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, complaint });
}

