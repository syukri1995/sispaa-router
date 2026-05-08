import { PrismaClient } from "@/generated/prisma/client";
import { getMariaDbAdapterFromEnv } from "@/lib/db/adapter";

declare global {
  var __sispaaPrisma: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (!globalThis.__sispaaPrisma) {
    globalThis.__sispaaPrisma = new PrismaClient({
      adapter: getMariaDbAdapterFromEnv(),
    });
  }
  return globalThis.__sispaaPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as any)[prop];
  },
});

