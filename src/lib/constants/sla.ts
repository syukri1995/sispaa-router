import { ComplaintPriority } from "@/generated/prisma/enums";

export function computeSlaDueAt(priority: ComplaintPriority, from = new Date()) {
  const hours =
    priority === ComplaintPriority.Critical
      ? 6
      : priority === ComplaintPriority.High
        ? 24
        : priority === ComplaintPriority.Medium
          ? 48
          : 72;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

