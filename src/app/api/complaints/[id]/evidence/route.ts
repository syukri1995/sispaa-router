import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["WORKER", "ADMIN"]);
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as
    | { imageUrls?: unknown; note?: unknown }
    | null;
  const imageUrls = Array.isArray(body?.imageUrls) ? body?.imageUrls.filter((u) => typeof u === "string") : [];
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (imageUrls.length === 0) return NextResponse.json({ error: "missing_evidence" }, { status: 400 });

  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (complaint.assignedWorkerId !== auth.session.sub && auth.session.role !== "ADMIN") {
    return NextResponse.json({ error: "not_assigned_to_you" }, { status: 403 });
  }

  const created = await prisma.actionLog.create({
    data: {
      complaintId: id,
      workerId: auth.session.sub,
      actorType: auth.session.role,
      eventType: "WORK_EVIDENCE",
      message: "Worker uploaded work evidence.",
      metadata: { imageUrls, note },
    },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

