import { cn } from "@/lib/utils";

const steps = ["SUBMITTED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type StatusStep = (typeof steps)[number];

export function StatusTimeline({ status }: { status: StatusStep }) {
  const idx = steps.indexOf(status);
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Status</div>
      <div className="grid gap-2">
        {steps.map((s, i) => {
          const done = i <= idx;
          return (
            <div key={s} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-3 w-3 rounded-full border",
                  done
                    ? "bg-[--color-sidebar-primary] border-[--color-sidebar-primary]"
                    : "bg-white/70 backdrop-blur"
                )}
              />
              <div className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

