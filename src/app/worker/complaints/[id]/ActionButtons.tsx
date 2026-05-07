"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Action = "ACCEPT" | "START" | "RESOLVE";

export function ActionButtons(props: { complaintId: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);

  const actions: Array<{ label: string; action: Action; tone: "blue" | "orange" | "green" }> =
    props.status === "ASSIGNED"
      ? [{ label: "Accept Job", action: "ACCEPT", tone: "blue" }]
      : props.status === "ACCEPTED"
        ? [{ label: "Start Work", action: "START", tone: "orange" }]
        : props.status === "IN_PROGRESS"
          ? [{ label: "Mark Resolved", action: "RESOLVE", tone: "green" }]
          : [];

  return (
    <div className="space-y-2">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.action}
            size="lg"
            disabled={pending !== null}
            className={
              a.tone === "blue"
                ? "h-12 bg-[color:var(--gov-blue)] text-white hover:bg-[color:var(--gov-blue)]/90"
                : a.tone === "orange"
                  ? "h-12 bg-[color:var(--gov-warning)] text-white hover:bg-[color:var(--gov-warning)]/90"
                  : "h-12 bg-[color:var(--gov-success)] text-white hover:bg-[color:var(--gov-success)]/90"
            }
            onClick={async () => {
              setError(null);
              setPending(a.action);
              try {
                const res = await fetch(`/api/complaints/${props.complaintId}/actions`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: a.action }),
                });
                const data = (await res.json().catch(() => null)) as unknown;
                if (!res.ok) {
                  const err =
                    typeof data === "object" &&
                    data !== null &&
                    "reason" in data &&
                    typeof (data as Record<string, unknown>).reason === "string"
                      ? String((data as Record<string, unknown>).reason)
                      : typeof data === "object" &&
                          data !== null &&
                          "error" in data &&
                          typeof (data as Record<string, unknown>).error === "string"
                        ? String((data as Record<string, unknown>).error)
                        : "action_failed";
                  setError(err);
                  return;
                }
                location.reload();
              } finally {
                setPending(null);
              }
            }}
          >
            {pending === a.action ? "Working…" : a.label}
          </Button>
        ))}
        {actions.length === 0 ? <div className="text-sm text-muted-foreground">No actions available.</div> : null}
      </div>
    </div>
  );
}

