import { formatDistanceToNowStrict } from "date-fns";

import { cn } from "@/lib/utils";

type Log = {
  id: string;
  actorType: "AI" | "WORKER" | "ADMIN" | "SYSTEM";
  eventType: string;
  message: string;
  metadata: unknown;
  createdAt: Date;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatGps(gps: { lat: number; lng: number; confidence: number | null }) {
  return `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}${gps.confidence !== null ? ` (conf ${gps.confidence.toFixed(2)})` : ""}`;
}

function getTone(eventType: string) {
  if (eventType.includes("ESCAL")) return "warn";
  if (eventType.startsWith("SLA_")) return "sla";
  if (eventType.includes("FAILED") || eventType.includes("ERROR")) return "danger";
  return "ai";
}

function getEventLabel(eventType: string) {
  if (eventType === "AI_INTAKE") return "Intake";
  if (eventType === "AI_CLASSIFIED") return "Category";
  if (eventType === "AI_PRIORITIZED") return "Severity";
  if (eventType === "AI_ROUTED") return "Agency";
  if (eventType === "AI_ASSIGNED") return "Assignment";
  if (eventType.startsWith("SLA_")) return "SLA";
  if (eventType.includes("ESCAL")) return "Escalation";
  return "Event";
}

function DecisionPanel({ eventType, metadata }: { eventType: string; metadata: unknown }) {
  const tone = getTone(eventType);
  const m = asRecord(metadata);
  if (!m) return null;

  const badge = (label: string) => (
    <span className="inline-flex items-center rounded-full border bg-white/70 px-2.5 py-1 text-[11px] font-medium leading-none text-foreground/80 shadow-sm">
      {label}
    </span>
  );

  const field = (label: string, value: string) => (
    <div className="rounded-xl border bg-white/70 px-3 py-2 shadow-sm">
      <div className="text-[11px] font-semibold tracking-wide text-foreground/60">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );

  // Common keys we tend to store
  const reason = asString(m.reason) ?? asString(m.message) ?? null;

  // AI_INTAKE
  if (eventType === "AI_INTAKE") {
    const intent = asString(m.intent);
    const summary = asString(m.summary);
    const suggestedTitle = asString(m.suggestedTitle);
    const locationText = asString(m.locationText);
    const gpsRaw = asRecord(m.gps);
    const gps =
      gpsRaw && asNumber(gpsRaw.lat) !== null && asNumber(gpsRaw.lng) !== null
        ? {
            lat: asNumber(gpsRaw.lat) as number,
            lng: asNumber(gpsRaw.lng) as number,
            confidence: asNumber(gpsRaw.confidence),
          }
        : null;

    return (
      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
          "bg-gradient-to-br",
          tone === "danger"
            ? "border-red-200 from-red-50 via-white to-red-50"
            : tone === "warn"
              ? "border-amber-200 from-amber-50 via-white to-amber-50"
              : tone === "sla"
                ? "border-blue-200 from-blue-50 via-white to-blue-50"
                : "border-emerald-200 from-emerald-50 via-white to-emerald-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
          <div className="flex flex-wrap gap-1.5">
            {intent ? badge(intent) : null}
            {locationText ? badge(locationText) : null}
          </div>
        </div>

        <div className="relative mt-2 grid gap-2 sm:grid-cols-2">
          {suggestedTitle ? field("Suggested title", suggestedTitle) : null}
          {gps ? field("Coordinates", formatGps(gps)) : field("Coordinates", "Not detected")}
        </div>

        {summary ? (
          <div className="relative mt-2 rounded-xl border bg-white/70 px-3 py-2 shadow-sm">
            <div className="text-[11px] font-semibold tracking-wide text-foreground/60">Summary</div>
            <div className="mt-0.5 text-sm text-foreground/90">{summary}</div>
          </div>
        ) : null}
      </div>
    );
  }

  // AI_CLASSIFIED
  if (eventType === "AI_CLASSIFIED") {
    const category = asString(m.category);
    return (
      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
          "bg-gradient-to-br",
          "border-emerald-200 from-emerald-50 via-white to-emerald-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
          {category ? badge(category) : null}
        </div>
        <div className="relative mt-2 grid gap-2 sm:grid-cols-2">
          {category ? field("Category", category) : field("Category", "Unknown")}
          {reason ? field("Why", reason) : field("Why", "—")}
        </div>
      </div>
    );
  }

  // AI_PRIORITIZED
  if (eventType === "AI_PRIORITIZED") {
    const priority = asString(m.priority);
    return (
      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
          "bg-gradient-to-br",
          "border-blue-200 from-blue-50 via-white to-blue-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
          {priority ? badge(priority) : null}
        </div>
        <div className="relative mt-2 grid gap-2 sm:grid-cols-2">
          {priority ? field("Severity", priority) : field("Severity", "Unknown")}
          {reason ? field("Why", reason) : field("Why", "—")}
        </div>
      </div>
    );
  }

  // AI_ROUTED
  if (eventType === "AI_ROUTED") {
    const agency = asString(m.agency);
    return (
      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
          "bg-gradient-to-br",
          "border-amber-200 from-amber-50 via-white to-amber-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
          {agency ? badge(agency) : null}
        </div>
        <div className="relative mt-2 grid gap-2 sm:grid-cols-2">
          {agency ? field("Agency", agency) : field("Agency", "Unknown")}
          {reason ? field("Why", reason) : field("Why", "—")}
        </div>
      </div>
    );
  }

  // AI_ASSIGNED
  if (eventType === "AI_ASSIGNED") {
    const ok = asBoolean(m.ok);
    const workerId = asString(m.workerId) ?? asString(m.workerID) ?? asString(m.worker) ?? null;
    const assignmentReason = asString(m.reason) ?? null;
    return (
      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border p-3 shadow-sm",
          "bg-gradient-to-br",
          (ok ?? true) ? "border-emerald-200 from-emerald-50 via-white to-emerald-50" : "border-red-200 from-red-50 via-white to-red-50"
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
          {badge(ok === false ? "Unassigned" : "Assigned")}
        </div>
        <div className="relative mt-2 grid gap-2 sm:grid-cols-2">
          {workerId ? field("Worker", workerId) : field("Worker", ok === false ? "No worker available" : "—")}
          {assignmentReason ? field("Why", assignmentReason) : field("Why", "—")}
        </div>
      </div>
    );
  }

  // Fallback: show key/value chips instead of JSON
  const entries = Object.entries(m)
    .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    .slice(0, 8);
  if (entries.length === 0) return null;

  return (
    <div className="relative mt-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-50 via-white to-zinc-50 p-3 shadow-sm">
      <div className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:linear-gradient(to_right,rgba(0,0,0,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.07)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wide text-foreground/70">Decision summary</div>
        <div className="text-[10px] font-medium text-muted-foreground">Details</div>
      </div>
      <div className="relative mt-2 flex flex-wrap gap-1.5">
        {entries.map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-[11px] font-medium leading-none text-foreground/80 shadow-sm"
          >
            <span className="text-foreground/50">{k}</span>
            <span className="text-foreground">{String(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function AIDecisionTimeline({ logs }: { logs: Log[] }) {
  const ai = logs.filter((l) => l.actorType === "AI" || l.eventType.startsWith("SLA_") || l.eventType.includes("ESCAL"));
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium tracking-tight">AI decision timeline</div>
        <div className="text-xs text-muted-foreground">{ai.length} event{ai.length === 1 ? "" : "s"}</div>
      </div>

      <div className="space-y-3">
        {ai.length === 0 ? (
          <div className="rounded-xl border bg-white/60 p-4 text-sm text-muted-foreground">
            No AI decisions recorded yet.
          </div>
        ) : (
          ai.map((l) => (
            <article key={l.id} className="group relative rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur">
              <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-transparent via-zinc-200 to-transparent" />

              <div className="relative flex gap-4">
                <div className="mt-0.5 flex w-10 shrink-0 justify-center">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full ring-4 ring-white shadow-sm",
                      getTone(l.eventType) === "danger"
                        ? "bg-red-600"
                        : getTone(l.eventType) === "warn"
                          ? "bg-amber-500"
                          : getTone(l.eventType) === "sla"
                            ? "bg-blue-600"
                            : "bg-emerald-600"
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
                          getTone(l.eventType) === "danger"
                            ? "border-red-200 bg-red-50 text-red-800"
                            : getTone(l.eventType) === "warn"
                              ? "border-amber-200 bg-amber-50 text-amber-900"
                              : getTone(l.eventType) === "sla"
                                ? "border-blue-200 bg-blue-50 text-blue-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900"
                        )}
                      >
                        {getEventLabel(l.eventType)}
                      </span>

                      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {l.message}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(l.createdAt), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">{l.eventType}</div>

                  {l.metadata ? (
                    <DecisionPanel eventType={l.eventType} metadata={l.metadata} />
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

