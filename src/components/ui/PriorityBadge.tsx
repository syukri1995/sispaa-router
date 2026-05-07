import { cn } from "@/lib/utils";

export type ComplaintPriority = "Low" | "Medium" | "High" | "Critical";

export function PriorityBadge({ priority }: { priority: ComplaintPriority | string }) {
  const p = priority as ComplaintPriority;
  const cls =
    p === "Critical"
      ? "bg-red-50 text-red-800 border-red-200"
      : p === "High"
        ? "bg-orange-50 text-orange-800 border-orange-200"
        : p === "Medium"
          ? "bg-blue-50 text-blue-800 border-blue-200"
          : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", cls)}>
      {priority}
    </span>
  );
}

