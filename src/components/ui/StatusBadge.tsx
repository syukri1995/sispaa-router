import { cn } from "@/lib/utils";

export type ComplaintStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export function StatusBadge({ status }: { status: ComplaintStatus | string }) {
  const s = status as ComplaintStatus;
  const cls =
    s === "SUBMITTED"
      ? "bg-gray-100 text-gray-700 border-gray-200"
      : s === "ASSIGNED"
        ? "bg-blue-50 text-blue-800 border-blue-200"
        : s === "ACCEPTED"
          ? "bg-cyan-50 text-cyan-800 border-cyan-200"
          : s === "IN_PROGRESS"
            ? "bg-orange-50 text-orange-800 border-orange-200"
            : s === "RESOLVED"
              ? "bg-green-50 text-green-800 border-green-200"
              : s === "CLOSED"
                ? "bg-zinc-100 text-zinc-700 border-zinc-200"
                : "bg-zinc-100 text-zinc-700 border-zinc-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", cls)}>
      {status}
    </span>
  );
}

