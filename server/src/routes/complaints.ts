import crypto from "node:crypto";

import { Router } from "express";

import { workforceAgent } from "../../../src/lib/agents/workforceAgent";
import { computeSlaDueAt } from "../../../src/lib/constants/sla";
import { prisma } from "../../../src/lib/db/prisma";
import { classificationAgent } from "../../../src/lib/agents/classificationAgent";
import { intakeAgent } from "../../../src/lib/agents/intakeAgent";
import { priorityAgent } from "../../../src/lib/agents/priorityAgent";
import { routingAgent } from "../../../src/lib/agents/routingAgent";
import { hammingDistanceHex64 } from "../../../src/lib/image/phashClient";
import { ComplaintPriority } from "../../../src/generated/prisma/enums";

type AgencyCode = "JKR" | "MOT" | "COUNCIL" | "AKSB";

export const complaintsRouter = Router();

complaintsRouter.get("/complaints/track/:trackingId", async (req, res) => {
  try {
    const trackingId = String(req.params.trackingId ?? "").trim();
    if (!trackingId) return res.status(400).json({ ok: false, error: "missing_trackingId" });

    const complaint = await prisma.complaint.findUnique({
      where: { trackingId },
      include: {
        agency: true,
        assignedWorker: { select: { id: true, email: true } },
        actionLogs: { orderBy: { createdAt: "asc" } },
        escalationLogs: { orderBy: { triggeredAt: "desc" } },
      },
    });

    if (!complaint) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, complaint });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("GET /api/complaints/track failed:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

function makeTrackingId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "SIS-";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

complaintsRouter.post("/complaints", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      title?: string;
      description?: string;
      imageUrls?: string[];
      imagePhashes?: string[];
      gps?: { lat: number; lng: number; confidence?: number } | null;
      locationText?: string | null;
      category?: string | null;
      severity?: string | null;
      agencyCode?: AgencyCode | null;
      ai?: { summary?: string; intent?: string; reasons?: { category?: string; severity?: string; agency?: string } };
      icNumber?: string;
      dedup?: { override?: boolean; overrideReason?: string };
    };

    const title = body.title?.trim();
    const description = body.description?.trim();
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
    const imagePhashes = Array.isArray(body.imagePhashes) ? body.imagePhashes.filter((x) => typeof x === "string") : [];
    const locationText = typeof body.locationText === "string" ? body.locationText.trim() : null;
    const category = typeof body.category === "string" ? body.category.trim() : null;
    const severity = typeof body.severity === "string" ? body.severity.trim() : null;
    const agencyCode = (body.agencyCode ?? null) as AgencyCode | null;
    const icRaw = String(body.icNumber ?? "").trim();
    const dedupOverride = body.dedup?.override === true;
    const dedupOverrideReason = typeof body.dedup?.overrideReason === "string" ? body.dedup?.overrideReason : null;

    const gps =
      body.gps && typeof body.gps === "object"
        ? {
            lat: Number((body.gps as Record<string, unknown>).lat),
            lng: Number((body.gps as Record<string, unknown>).lng),
            confidence:
              typeof (body.gps as Record<string, unknown>).confidence === "number"
                ? ((body.gps as Record<string, unknown>).confidence as number)
                : null,
          }
        : null;

    if (!title || !description) return res.status(400).json({ ok: false, error: "missing_title_or_description" });
    if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) return res.status(400).json({ ok: false, error: "invalid_gps" });
    if (!icRaw) return res.status(400).json({ ok: false, error: "missing_ic" });
    if (!category) return res.status(400).json({ ok: false, error: "missing_category" });
    if (!severity) return res.status(400).json({ ok: false, error: "missing_severity" });
    if (!agencyCode) return res.status(400).json({ ok: false, error: "missing_agency" });

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
          aiSummary: body.ai?.summary ?? null,
          aiReasoning: JSON.stringify({
            reasons: {
              classification: body.ai?.reasons?.category ?? null,
              priority: body.ai?.reasons?.severity ?? null,
              routing: body.ai?.reasons?.agency ?? null,
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
          { complaintId: complaint.id, actorType: "SYSTEM", eventType: "SUBMITTED", message: "Complaint submitted." },
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
            metadata: { intent: body.ai?.intent ?? null, summary: body.ai?.summary ?? null, locationText, gps },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_CLASSIFIED",
            message: "AI classified complaint category.",
            metadata: { category, reason: body.ai?.reasons?.category ?? null },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_PRIORITIZED",
            message: "AI determined urgency priority.",
            metadata: { priority: severity, reason: body.ai?.reasons?.severity ?? null },
          },
          {
            complaintId: complaint.id,
            actorType: "AI",
            eventType: "AI_ROUTED",
            message: "AI selected agency.",
            metadata: { agency: agencyCode, reason: body.ai?.reasons?.agency ?? null },
          },
        ],
      });

      if (agency?.id) {
        const wf = await workforceAgent({ agencyId: agency.id, category: complaint.category });
        if (wf.ok && wf.workerId) {
          await tx.complaint.update({
            where: { id: complaint.id },
            data: { assignedWorker: { connect: { id: wf.workerId } }, status: "ASSIGNED" },
          });
          await tx.assignment.create({ data: { complaintId: complaint.id, workerId: wf.workerId, status: "ASSIGNED" } });
          await tx.worker.update({ where: { id: wf.workerId }, data: { currentWorkload: { increment: 1 } } });
          await tx.actionLog.create({
            data: { complaintId: complaint.id, actorType: "AI", eventType: "AI_ASSIGNED", message: "AI assigned best available worker.", metadata: wf },
          });
        } else {
          await tx.actionLog.create({
            data: { complaintId: complaint.id, actorType: "SYSTEM", eventType: "UNASSIGNED", message: wf.reason },
          });
        }
      }

      return complaint;
    });

    return res.json({
      ok: true,
      trackingId: created.trackingId,
      agency: agency ? { code: agency.code, name: agency.name } : null,
      severity: priorityEnum,
      gps,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("POST /api/complaints failed:", e);
    if (/DATABASE_URL is required/i.test(msg)) return res.status(500).json({ ok: false, error: "database_unconfigured" });
    if (/Prisma|ECONN|ETIMEDOUT|getaddrinfo|Handshake|SSL|certificate/i.test(msg))
      return res.status(500).json({ ok: false, error: "database_connection_failed" });
    return res.status(500).json({ ok: false, error: "submit_failed" });
  }
});

// ===== Preview =====
function ruleBasedAgency(input: { title: string; description: string }): { agencyCode: AgencyCode; reason: string } | null {
  const t = `${input.title}\n${input.description}`.toLowerCase();
  if (
    /\b(broken\s+pipe|pipe\s+burst|water\s+leak|leaking\s+pipe|paip\s+pecah|paip\s+bocor|kebocoran\s+air|water\s+supply|no\s+water|tiada\s+air|bekalan\s+air)\b/i.test(
      t
    )
  ) {
    return { agencyCode: "AKSB", reason: "Rule-based routing: water supply / pipe issues are handled by AKSB." };
  }
  return null;
}

complaintsRouter.post("/complaints/preview", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { description?: string; title?: string; gps?: { lat: number; lng: number; confidence?: number } | null };
    const description = (body.description ?? "").trim();
    const title = (body.title ?? "").trim();
    const gps =
      body.gps && typeof body.gps === "object"
        ? {
            lat: Number((body.gps as Record<string, unknown>).lat),
            lng: Number((body.gps as Record<string, unknown>).lng),
            confidence:
              typeof (body.gps as Record<string, unknown>).confidence === "number"
                ? ((body.gps as Record<string, unknown>).confidence as number)
                : null,
          }
        : null;

    if (!description) return res.status(400).json({ ok: false, error: "missing_description" });
    if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) return res.status(400).json({ ok: false, error: "invalid_gps" });

    const [intake, classification, priority] = await Promise.all([
      intakeAgent({ title: title || "Auto", description }),
      classificationAgent({ title: title || "Auto", description }),
      priorityAgent({ title: title || "Auto", description }),
    ]);

    const rule = ruleBasedAgency({ title, description });
    const routing = rule
      ? { ok: true as const, data: { agency: "AKSB" as const, reason: rule.reason } }
      : await routingAgent({ category: classification.data.category, intent: intake.data.intent });

    const agencyCode: AgencyCode =
      routing.data.agency === "JKR"
        ? "JKR"
        : routing.data.agency === "Transport Ministry"
          ? "MOT"
          : routing.data.agency === "AKSB"
            ? "AKSB"
            : "COUNCIL";

    return res.json({
      ok: true,
      preview: {
        title: intake.data.suggestedTitle || title || "Public complaint",
        description,
        summary: intake.data.summary,
        intent: intake.data.intent,
        locationText: intake.data.locationText,
        gps: gps ?? intake.data.gps ?? null,
        category: classification.data.category,
        severity: priority.data.priority,
        agencyCode,
        reasons: {
          category: classification.data.reason,
          severity: priority.data.reason,
          agency: routing.ok ? routing.data.reason : `${routing.data.reason} (${routing.error})`,
        },
        fromFallback: {
          intake: !intake.ok,
          classification: !classification.ok,
          priority: !priority.ok,
          routing: !routing.ok,
        },
        routingError: routing.ok ? null : routing.error,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("POST /api/complaints/preview failed:", e);
    if (/GROQ_API_KEY|OPENAI_API_KEY|Invalid API Key/i.test(msg)) return res.status(500).json({ ok: false, error: "llm_unconfigured" });
    return res.status(500).json({ ok: false, error: "preview_failed" });
  }
});

// ===== Dedup-check =====
function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function trigrams(s: string) {
  const t = `  ${s}  `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 2; i++) out.push(t.slice(i, i + 3));
  return out;
}
function trigramDice(a: string, b: string) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  const A = trigrams(na);
  const B = trigrams(nb);
  const map = new Map<string, number>();
  for (const g of A) map.set(g, (map.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of B) {
    const c = map.get(g) ?? 0;
    if (c > 0) {
      map.set(g, c - 1);
      inter++;
    }
  }
  return (2 * inter) / (A.length + B.length);
}
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function distanceSignal(distanceM: number, radiusM: number) {
  if (distanceM <= 0) return 1;
  if (distanceM >= radiusM) return 0;
  return 1 - distanceM / radiusM;
}
function imageSignalFromHashes(newHashes: string[], candidateHashes: string[]) {
  if (newHashes.length === 0 || candidateHashes.length === 0) return 0;
  let best = 0;
  for (const a of newHashes) {
    for (const b of candidateHashes) {
      if (!a || !b) continue;
      try {
        const d = hammingDistanceHex64(a, b);
        const sig = 1 - d / 64;
        if (sig > best) best = sig;
      } catch {
        // ignore bad hashes
      }
    }
  }
  return best;
}

complaintsRouter.post("/complaints/dedup-check", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      title?: string;
      description?: string;
      category?: string;
      gps?: { lat: number; lng: number } | null;
      imagePhashes?: string[];
    };
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const gps =
      body.gps && typeof body.gps === "object"
        ? { lat: Number((body.gps as Record<string, unknown>).lat), lng: Number((body.gps as Record<string, unknown>).lng) }
        : null;
    const imagePhashes = Array.isArray(body.imagePhashes) ? body.imagePhashes.filter((x) => typeof x === "string") : [];

    if (!gps && imagePhashes.length === 0) return res.json({ ok: true, matches: [] });
    if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) return res.status(400).json({ ok: false, error: "invalid_gps" });

    const now = new Date();
    const radiusM = 250;
    const windowStart = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const resolvedWindowStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    let candidates: Array<{
      id: string;
      trackingId: string;
      title: string;
      description: string;
      aiSummary: string | null;
      category: string | null;
      priority: string;
      status: string;
      agency: { name: string } | null;
      gpsLat: number | null;
      gpsLng: number | null;
      createdAt: Date;
      evidenceImages: Array<{ phash: string | null }>;
    }>;

    if (gps) {
      const latDelta = radiusM / 111000;
      const lngDelta = radiusM / (111000 * Math.cos((gps.lat * Math.PI) / 180));
      const minLat = gps.lat - latDelta;
      const maxLat = gps.lat + latDelta;
      const minLng = gps.lng - lngDelta;
      const maxLng = gps.lng + lngDelta;

      candidates = await prisma.complaint.findMany({
        where: {
          createdAt: { gte: windowStart },
          OR: [
            { status: { in: ["SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] } },
            { status: "RESOLVED", updatedAt: { gte: resolvedWindowStart } },
          ],
          gpsLat: { gte: minLat, lte: maxLat },
          gpsLng: { gte: minLng, lte: maxLng },
        },
        take: 80,
        include: { agency: { select: { name: true } }, evidenceImages: { select: { phash: true } } },
      });
    } else {
      candidates = await prisma.complaint.findMany({
        where: {
          createdAt: { gte: windowStart },
          OR: [
            { status: { in: ["SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] } },
            { status: "RESOLVED", updatedAt: { gte: resolvedWindowStart } },
          ],
        },
        take: 80,
        include: { agency: { select: { name: true } }, evidenceImages: { select: { phash: true } } },
      });
    }

    const qText = `${title}\n${description}\n${body.category ?? ""}`.trim();
    const scored = candidates
      .map((c) => {
        const dM =
          gps && typeof c.gpsLat === "number" && typeof c.gpsLng === "number" ? haversineM(gps.lat, gps.lng, c.gpsLat, c.gpsLng) : null;
        const dSig = dM === null ? 0 : distanceSignal(dM, radiusM);
        const cText = `${c.title}\n${c.aiSummary ?? ""}\n${c.category ?? ""}\n${c.description}`.trim();
        const tSig = trigramDice(qText, cText);
        const cHashes = c.evidenceImages.map((x) => x.phash).filter((x): x is string => typeof x === "string");
        const iSig = imageSignalFromHashes(imagePhashes, cHashes);
        const hasImage = imagePhashes.length > 0;
        const score = hasImage ? 0.45 * dSig + 0.25 * tSig + 0.3 * iSig : 0.65 * dSig + 0.35 * tSig;
        return { c, distanceM: dM === null ? null : Math.round(dM), score, signals: { distance: dSig, text: tSig, image: hasImage ? iSig : 0 } };
      })
      .filter((x) => {
        const cond1 = x.distanceM !== null && x.distanceM <= 80 && x.signals.text >= 0.45;
        const cond2 = x.distanceM !== null && x.distanceM <= 250 && x.signals.image >= 1 - 8 / 64;
        const cond3 = x.score >= 0.72;
        return cond1 || cond2 || cond3;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => ({
        complaintId: x.c.id,
        trackingId: x.c.trackingId,
        title: x.c.title,
        status: x.c.status,
        priority: x.c.priority,
        agencyName: x.c.agency?.name ?? null,
        distanceM: x.distanceM,
        createdAt: x.c.createdAt,
        score: Number(x.score.toFixed(3)),
        signals: {
          distance: Number(x.signals.distance.toFixed(3)),
          text: Number(x.signals.text.toFixed(3)),
          image: Number(x.signals.image.toFixed(3)),
        },
      }));

    return res.json({ ok: true, matches: scored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("POST /api/complaints/dedup-check failed:", e);
    if (/DATABASE_URL is required/i.test(msg)) return res.status(500).json({ ok: false, error: "database_unconfigured" });
    if (/Prisma|ECONN|ETIMEDOUT|getaddrinfo|Handshake|SSL|certificate/i.test(msg))
      return res.status(500).json({ ok: false, error: "database_connection_failed" });
    return res.status(500).json({ ok: false, error: "dedup_check_failed" });
  }
});

