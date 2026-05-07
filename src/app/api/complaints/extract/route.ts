import { NextResponse } from "next/server";

import { intakeAgent } from "@/lib/agents/intakeAgent";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { description?: string; title?: string }
    | null;
  const description = body?.description?.trim() ?? "";
  const title = body?.title?.trim() ?? "";
  if (!description) return NextResponse.json({ error: "missing_description" }, { status: 400 });

  const intake = await intakeAgent({ title: title || "Auto", description });
  return NextResponse.json({
    ok: true,
    suggestion: {
      title: intake.data.suggestedTitle,
      locationText: intake.data.locationText,
      gps: intake.data.gps,
      summary: intake.data.summary,
      intent: intake.data.intent,
      fromFallback: !intake.ok,
    },
  });
}

