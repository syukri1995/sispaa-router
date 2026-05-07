import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function tryGetEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v : null;
}

export function getMariaDbAdapterFromEnv(): PrismaMariaDb | null {
  const raw = tryGetEnv("DATABASE_URL");
  if (!raw) return null;
  const u = new URL(raw);

  const database = u.pathname?.replace(/^\//, "");
  if (!database) return null;

  return new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username ?? ""),
    password: decodeURIComponent(u.password ?? ""),
    database,
    ssl: true,
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
    connectionLimit: 10,
  });
}

