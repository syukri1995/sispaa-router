import { PrismaClient } from "@/generated/prisma/client";
import { getMariaDbAdapterFromEnv } from "@/lib/db/adapter";

declare global {
  var __sispaaPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__sispaaPrisma ??
  new PrismaClient({
    adapter: getMariaDbAdapterFromEnv(),
  });

if (process.env.NODE_ENV !== "production") globalThis.__sispaaPrisma = prisma;

