import { prisma } from "@/lib/db/prisma";

export async function workforceAgent(input: { agencyId: string; category?: string | null }) {
  const workers = await prisma.worker.findMany({
    where: { agencyId: input.agencyId, active: true, role: "WORKER" },
    orderBy: [{ currentWorkload: "asc" }, { updatedAt: "asc" }],
    take: 25,
  });

  if (workers.length === 0) {
    return { ok: false as const, workerId: null, reason: "No active workers in agency." };
  }

  // Simple hackathon heuristic: pick least workload.
  const best = workers[0];
  return { ok: true as const, workerId: best.id, reason: "Least workload worker selected." };
}

