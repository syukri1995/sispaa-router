"use client";

import { Button } from "@/components/ui/button";

function nextActionLabel(status: string) {
  if (status === "ASSIGNED") return "Accept";
  if (status === "ACCEPTED") return "Start";
  if (status === "IN_PROGRESS") return "Resolve";
  return null;
}

function nextActionType(status: string) {
  if (status === "ASSIGNED") return "ACCEPT";
  if (status === "ACCEPTED") return "START";
  if (status === "IN_PROGRESS") return "RESOLVE";
  return null;
}

export function NextActionButton(props: { complaintId: string; status: string }) {
  const label = nextActionLabel(props.status);
  const action = nextActionType(props.status);
  const tone =
    props.status === "ASSIGNED"
      ? "blue"
      : props.status === "ACCEPTED"
        ? "orange"
        : props.status === "IN_PROGRESS"
          ? "green"
          : "gray";

  if (!label || !action) return null;

  return (
    <Button
      size="sm"
      className={
        tone === "blue"
          ? "h-10 bg-[color:var(--gov-blue)] text-white hover:bg-[color:var(--gov-blue)]/90"
          : tone === "orange"
            ? "h-10 bg-[color:var(--gov-warning)] text-white hover:bg-[color:var(--gov-warning)]/90"
            : "h-10 bg-[color:var(--gov-success)] text-white hover:bg-[color:var(--gov-success)]/90"
      }
      onClick={async () => {
        const res = await fetch(`/api/complaints/${props.complaintId}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) return;
        location.reload();
      }}
    >
      {label}
    </Button>
  );
}

