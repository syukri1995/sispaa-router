import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => null)) as
    | { complaintId?: string; agencyCode?: "JKR" | "COUNCIL" | "MOT"; workerId?: string | null }
    | null;

  const complaintId = body?.complaintId;
  if (!complaintId) return NextResponse.json({ error: "missing_complaintId" }, { status: 400 });

  const agency =
    body?.agencyCode ? await prisma.agency.findUnique({ where: { code: body.agencyCode } }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaintId },
      data: {
        agencyId: agency ? agency.id : undefined,
        assignedWorkerId: body?.workerId === undefined ? undefined : body.workerId,
      },
    });
    await tx.actionLog.create({
      data: {
        complaintId,
        workerId: auth.session.sub,
        actorType: "ADMIN",
        eventType: "ADMIN_OVERRIDE",
        message: "Admin override applied.",
        metadata: { agencyCode: body?.agencyCode, workerId: body?.workerId },
      },
    });
  });

  return NextResponse.json({ ok: true });
}

