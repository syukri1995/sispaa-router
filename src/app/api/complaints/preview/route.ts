import { NextResponse } from "next/server";

import { classificationAgent } from "@/lib/agents/classificationAgent";
import { intakeAgent } from "@/lib/agents/intakeAgent";
import { priorityAgent } from "@/lib/agents/priorityAgent";
import { routingAgent } from "@/lib/agents/routingAgent";

function ruleBasedAgency(input: { title: string; description: string }) {
  const t = `${input.title}\n${input.description}`.toLowerCase();

  // Utilities: broken pipes / water leaks (not perfectly represented in our 3-agency list).
  // Route water supply/pipe issues to AKSB (Kelantan water utility).
  if (
    /\b(broken\s+pipe|pipe\s+burst|water\s+leak|leaking\s+pipe|paip\s+pecah|paip\s+bocor|kebocoran\s+air|water\s+supply|no\s+water|tiada\s+air|bekalan\s+air)\b/i.test(
      t
    )
  ) {
    return { agencyCode: "AKSB" as const, reason: "Rule-based routing: water supply / pipe issues are handled by AKSB." };
  }

  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { description?: string; title?: string; gps?: { lat: number; lng: number; confidence?: number } | null }
    | null;

  const description = body?.description?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
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

  if (!description) return NextResponse.json({ ok: false, error: "missing_description" }, { status: 400 });
  if (gps && (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng))) {
    return NextResponse.json({ ok: false, error: "invalid_gps" }, { status: 400 });
  }

  // Run independent AI agents in parallel to reduce latency.
  const [intake, classification, priority] = await Promise.all([
    intakeAgent({ title: title || "Auto", description }),
    classificationAgent({ title: title || "Auto", description }),
    priorityAgent({ title: title || "Auto", description }),
  ]);
  const rule = ruleBasedAgency({ title, description });
  const routing = rule
    ? {
        ok: true as const,
        data: {
          agency:
            rule.agencyCode === "JKR"
              ? "JKR"
              : rule.agencyCode === "MOT"
                ? "Transport Ministry"
                : rule.agencyCode === "AKSB"
                  ? "AKSB"
                  : "Local Council",
          reason: rule.reason,
        },
      }
    : await routingAgent({
        category: classification.data.category,
        intent: intake.data.intent,
      });

  const agencyCode =
    routing.data.agency === "JKR"
      ? "JKR"
      : routing.data.agency === "Transport Ministry"
        ? "MOT"
        : routing.data.agency === "AKSB"
          ? "AKSB"
          : "COUNCIL";

  return NextResponse.json({
    ok: true,
    preview: {
      // user-visible editable fields
      title: intake.data.suggestedTitle || title || "Public complaint",
      description,
      summary: intake.data.summary,
      intent: intake.data.intent,
      locationText: intake.data.locationText,
      gps: gps ?? intake.data.gps ?? null,
      category: classification.data.category,
      severity: priority.data.priority,
      agencyCode,

      // reasoning for transparency
      reasons: {
        category: classification.data.reason,
        severity: priority.data.reason,
        agency: routing.ok ? routing.data.reason : `${routing.data.reason} (${routing.error})`,
      },

      // diagnostic (optional)
      fromFallback: {
        intake: !intake.ok,
        classification: !classification.ok,
        priority: !priority.ok,
        routing: !routing.ok,
      },
      routingError: routing.ok ? null : routing.error,
    },
  });
}

