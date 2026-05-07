"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

export function SlaBadge({ slaDueAt }: { slaDueAt: Date | string | null }) {
  const due = useMemo(() => (slaDueAt ? new Date(slaDueAt) : null), [slaDueAt]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  if (!due) return <span className="text-xs text-muted-foreground">No SLA</span>;
  const diff = due.getTime() - now;
  const overdue = diff < 0;
  return (
    <span
      className={
        overdue
          ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
          : "rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
      }
      title={due.toISOString()}
    >
      {overdue ? `Overdue by ${fmt(-diff)}` : `${fmt(diff)} left`}
    </span>
  );
}

