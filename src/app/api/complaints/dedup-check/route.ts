import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { hammingDistanceHex64 } from "@/lib/image/phashClient";

function normalizeText(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function distanceSignal(distanceM: number, radiusM: number) {
  if (distanceM <= 0) return 1;
  if (distanceM >= radiusM) return 0;
  // Linear decay is explainable and stable.
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          title?: string;
          description?: string;
          category?: string;
          severity?: string;
          agencyCode?: string;
          locationText?: string | null;
          gps?: { lat: number; lng: number } | null;
          imageUrls?: string[];
          imagePhashes?: string[];
        }
      | null;

    const title = (body?.title ?? "").trim();
    const description = (body?.description ?? "").trim();
    const gps =
      body?.gps && typeof body.gps === "object"
        ? {
            lat: Number((body.gps as Record<string, unknown>).lat),
            lng: Number((body.gps as Record<string, unknown>).lng),
          }
        : null;
    const imagePhashes = Array.isArray(body?.imagePhashes)
      ? body!.imagePhashes.filter((x) => typeof x === "string")
      : [];

    // Skip rule: no GPS and no image hashes => too noisy.
    if (!gps && imagePhashes.length === 0) return NextResponse.json({ ok: true, matches: [] });
    if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) {
      return NextResponse.json({ ok: false, error: "invalid_gps" }, { status: 400 });
    }

    const now = new Date();
    const radiusM = 250;
    const windowStart = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const resolvedWindowStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Candidate query.
    // If GPS exists: bounding box prefilter. Otherwise: fall back to recent active complaints (tighter later scoring via image/text).
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

    const qText = `${title}\n${description}\n${body?.category ?? ""}`.trim();

    const scored = candidates
      .map((c) => {
        const dM =
          gps && typeof c.gpsLat === "number" && typeof c.gpsLng === "number"
            ? haversineM(gps.lat, gps.lng, c.gpsLat, c.gpsLng)
            : null;
        const dSig = dM === null ? 0 : distanceSignal(dM, radiusM);

        const cText = `${c.title}\n${c.aiSummary ?? ""}\n${c.category ?? ""}\n${c.description}`.trim();
        const tSig = trigramDice(qText, cText);

        const cHashes = c.evidenceImages.map((x) => x.phash).filter((x): x is string => typeof x === "string");
        const iSig = imageSignalFromHashes(imagePhashes, cHashes);

        const hasImage = imagePhashes.length > 0;
        const score = hasImage ? 0.45 * dSig + 0.25 * tSig + 0.3 * iSig : 0.65 * dSig + 0.35 * tSig;

        return {
          c,
          distanceM: dM === null ? null : Math.round(dM),
          score,
          signals: {
            distance: dSig,
            text: tSig,
            image: hasImage ? iSig : 0,
          },
        };
      })
      .filter((x) => {
        // Panel thresholds (mixed density defaults)
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

    return NextResponse.json({ ok: true, matches: scored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("POST /api/complaints/dedup-check failed:", e);
    if (/DATABASE_URL is required/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "database_unconfigured" }, { status: 500 });
    }
    if (/Prisma|ECONN|ETIMEDOUT|getaddrinfo|Handshake|SSL|certificate/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "database_connection_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "dedup_check_failed" }, { status: 500 });
  }
}

