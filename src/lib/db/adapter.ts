import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

export function getMariaDbAdapterFromEnv() {
  const raw = mustGetEnv("DATABASE_URL");
  const u = new URL(raw);

  const database = u.pathname?.replace(/^\//, "");
  if (!database) throw new Error("DATABASE_URL must include a database name");

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

