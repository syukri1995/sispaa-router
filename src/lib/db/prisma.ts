import { PrismaClient } from "@/generated/prisma/client";
import { getMariaDbAdapterFromEnv } from "@/lib/db/adapter";

declare global {
  var __sispaaPrisma: PrismaClient | undefined;
}

const adapter = getMariaDbAdapterFromEnv();

export const prisma: PrismaClient =
  globalThis.__sispaaPrisma ??
  new PrismaClient({ adapter: (adapter ?? undefined) as any } as any);

if (process.env.NODE_ENV !== "production") globalThis.__sispaaPrisma = prisma;

