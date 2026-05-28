import { NextResponse } from "next/server";

import crypto from "node:crypto";

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
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          title?: string;
          description?: string;
          imageUrls?: string[];
          imagePhashes?: string[];
          gps?: { lat: number; lng: number; confidence?: number } | null;
          locationText?: string | null;
          category?: string | null;
          severity?: string | null;
          agencyCode?: "JKR" | "MOT" | "COUNCIL" | "AKSB" | null;
          ai?: { summary?: string; intent?: string; reasons?: { category?: string; severity?: string; agency?: string } };
          icNumber?: string;
          dedup?: { override?: boolean; overrideReason?: string };
        }
      | null;
    const title = body?.title?.trim();
    const description = body?.description?.trim();
    const imageUrls = Array.isArray(body?.imageUrls) ? body?.imageUrls : [];
    const imagePhashes = Array.isArray(body?.imagePhashes)
      ? body?.imagePhashes.filter((x) => typeof x === "string")
      : [];
    const locationText = typeof body?.locationText === "string" ? body.locationText.trim() : null;
    const category = typeof body?.category === "string" ? body.category.trim() : null;
    const severity = typeof body?.severity === "string" ? body.severity.trim() : null;
    const agencyCode = body?.agencyCode ?? null;
    const icRaw = String(body?.icNumber ?? "").trim();
    const dedupOverride = body?.dedup?.override === true;
    const dedupOverrideReason = typeof body?.dedup?.overrideReason === "string" ? body?.dedup?.overrideReason : null;
    const gps =
      body?.gps && typeof body.gps === "object"
        ? {
            lat: Number((body.gps as Record<string, unknown>).lat),
            lng: Number((body.gps as Record<string, unknown>).lng),
            confidence:
              typeof (body.gps as Record<string, unknown>).confidence === "number"
                ? ((body.gps as Record<string, unknown>).confidence as number)
                : null,
          }
        : null;

    if (!title || !description) {
      return NextResponse.json({ error: "missing_title_or_description" }, { status: 400 });
    }
    if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) {
      return NextResponse.json({ error: "invalid_gps" }, { status: 400 });
    }
    if (!icRaw) return NextResponse.json({ error: "missing_ic" }, { status: 400 });
    if (!category) return NextResponse.json({ error: "missing_category" }, { status: 400 });
    if (!severity) return NextResponse.json({ error: "missing_severity" }, { status: 400 });
    if (!agencyCode) return NextResponse.json({ error: "missing_agency" }, { status: 400 });

    const trackingId = makeTrackingId();

    const priorityEnum =
      severity === "Critical"
        ? ComplaintPriority.Critical
        : severity === "High"
          ? ComplaintPriority.High
          : severity === "Low"
            ? ComplaintPriority.Low
            : ComplaintPriority.Medium;
    const slaDueAt = computeSlaDueAt(priorityEnum);

    const agency = await prisma.agency.findUnique({ where: { code: agencyCode } });

    // Hash IC with a server-side pepper (SESSION_SECRET).
    const pepper = process.env.SESSION_SECRET ?? "dev";
    const reporterIcHash = crypto.createHash("sha256").update(`${pepper}:${icRaw}`).digest("hex");
    const digits = icRaw.replace(/\D/g, "");
    const reporterIcLast4 = digits.length >= 4 ? digits.slice(-4) : null;

    const created = await prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          trackingId,
          title,
          description,
          imageUrls,
          category,
          priority: priorityEnum,
          status: "SUBMITTED",
          agency: agency?.id ? { connect: { id: agency.id } } : undefined,
          locationText,
          gpsLat: gps?.lat ?? null,
          gpsLng: gps?.lng ?? null,
          gpsConfidence: gps?.confidence ?? null,
          reporterIcHash,
          reporterIcLast4,
          aiSummary: body?.ai?.summary ?? null,
          aiReasoning: JSON.stringify({
            reasons: {
              classification: body?.ai?.reasons?.category ?? null,
              priority: body?.ai?.reasons?.severity ?? null,
              routing: body?.ai?.reasons?.agency ?? null,
            },
          }),
          slaDueAt,
          dedupOverrideAt: dedupOverride ? new Date() : null,
          dedupOverrideReason: dedupOverride ? (dedupOverrideReason ?? "user_override") : null,
        },
      });

      if (imageUrls.length) {
        await tx.evidenceImage.createMany({
          data: imageUrls.map((url, idx) => ({
            complaintId: complaint.id,
            url,
            phash: typeof imagePhashes[idx] === "string" ? (imagePhashes[idx] as string) : null,
          })),
        });
      }

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
            actorType: "SYSTEM",
            eventType: "USER_VERIFIED",
            message: "User verified identity and confirmed submission details.",
            metadata: { reporterIcLast4 },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_INTAKE",
            message: "AI extracted intent and summary.",
            metadata: {
              intent: body?.ai?.intent ?? null,
              summary: body?.ai?.summary ?? null,
              locationText,
              gps,
            },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_CLASSIFIED",
            message: "AI classified complaint category.",
            metadata: { category, reason: body?.ai?.reasons?.category ?? null },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_PRIORITIZED",
            message: "AI determined urgency priority.",
            metadata: { priority: severity, reason: body?.ai?.reasons?.severity ?? null },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_ROUTED",
            message: "AI selected agency.",
            metadata: { agency: agencyCode, reason: body?.ai?.reasons?.agency ?? null },
          },
        ],
      });

      if (agency?.id) {
        const wf = await workforceAgent({ agencyId: agency.id, category: complaint.category });
        if (wf.ok && wf.workerId) {
          await tx.complaint.update({
            where: { id: complaint.id },
            data: {
              assignedWorker: { connect: { id: wf.workerId } },
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

    return NextResponse.json({
      ok: true,
      trackingId: created.trackingId,
      agency: agency ? { code: agency.code, name: agency.name } : null,
      severity: priorityEnum,
      gps,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/complaints failed:", e);
    if (/DATABASE_URL is required/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "database_unconfigured" }, { status: 500 });
    }
    if (/Prisma|ECONN|ETIMEDOUT|getaddrinfo|Handshake|SSL|certificate/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "database_connection_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
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

