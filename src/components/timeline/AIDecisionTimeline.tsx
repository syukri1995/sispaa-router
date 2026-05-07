import { formatDistanceToNowStrict } from "date-fns";

type Log = {
  id: string;
  actorType: "AI" | "WORKER" | "ADMIN" | "SYSTEM";
  eventType: string;
  message: string;
  metadata: unknown;
  createdAt: Date;
};

export function AIDecisionTimeline({ logs }: { logs: Log[] }) {
  const ai = logs.filter((l) => l.actorType === "AI" || l.eventType.startsWith("SLA_") || l.eventType.includes("ESCAL"));
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">AI decision timeline</div>
      <div className="space-y-3">
        {ai.length === 0 ? (
          <div className="text-sm text-muted-foreground">No AI decisions recorded yet.</div>
        ) : (
          ai.map((l) => (
            <div key={l.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{l.message}</div>
                  <div className="text-xs text-muted-foreground">{l.eventType}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(l.createdAt), { addSuffix: true })}
                </div>
              </div>
              {l.metadata ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-zinc-50 p-2 text-xs">
                  {JSON.stringify(l.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

