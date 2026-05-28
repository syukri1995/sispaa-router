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

  const rejectUnauthorizedEnv = (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "").trim().toLowerCase();
  const rejectUnauthorized =
    rejectUnauthorizedEnv === "1" || rejectUnauthorizedEnv === "true" || rejectUnauthorizedEnv === "yes";

  return new PrismaMariaDb({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username ?? ""),
    password: decodeURIComponent(u.password ?? ""),
    database,
    // TiDB Cloud often presents a chain that fails Node's default verification on some Windows setups.
    // Default to allowing TLS without strict verification in dev; set DB_SSL_REJECT_UNAUTHORIZED=1 to harden.
    ssl: { rejectUnauthorized },
    connectTimeout: 10_000,
    acquireTimeout: 10_000,
    connectionLimit: 10,
  });
}

