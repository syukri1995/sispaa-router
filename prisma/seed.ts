import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient, WorkerRole } from "../src/generated/prisma/client";

function getMariaDbAdapterFromDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required for seeding");
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
  });
}

const prisma = new PrismaClient({ adapter: getMariaDbAdapterFromDatabaseUrl() });

async function main() {
  const agencies = [
    {
      code: "JKR",
      name: "JKR",
      supportedCategories: ["Road Damage", "Drainage"],
    },
    {
      code: "AKSB",
      name: "AKSB",
      supportedCategories: ["Drainage", "General"],
    },
    {
      code: "COUNCIL",
      name: "Local Council",
      supportedCategories: ["Drainage", "Public Safety", "General"],
    },
    {
      code: "MOT",
      name: "Transport Ministry",
      supportedCategories: ["Transport"],
    },
  ];

  for (const agency of agencies) {
    await prisma.agency.upsert({
      where: { code: agency.code },
      update: { name: agency.name, supportedCategories: agency.supportedCategories },
      create: agency,
    });
  }

  const adminPasswordHash = await bcrypt.hash("admin1234", 10);
  const workerPasswordHash = await bcrypt.hash("worker1234", 10);

  const council = await prisma.agency.findUnique({ where: { code: "COUNCIL" } });
  const jkr = await prisma.agency.findUnique({ where: { code: "JKR" } });

  await prisma.worker.upsert({
    where: { email: "admin@sispaa.local" },
    update: { role: WorkerRole.ADMIN, active: true },
    create: {
      email: "admin@sispaa.local",
      passwordHash: adminPasswordHash,
      role: WorkerRole.ADMIN,
      agencyId: council?.id ?? null,
      specializations: ["General"],
      currentWorkload: 0,
      active: true,
    },
  });

  await prisma.worker.upsert({
    where: { email: "worker.jkr@sispaa.local" },
    update: { role: WorkerRole.WORKER, active: true },
    create: {
      email: "worker.jkr@sispaa.local",
      passwordHash: workerPasswordHash,
      role: WorkerRole.WORKER,
      agencyId: jkr?.id ?? null,
      specializations: ["Road Damage", "Drainage"],
      currentWorkload: 0,
      active: true,
    },
  });

  await prisma.worker.upsert({
    where: { email: "worker.council@sispaa.local" },
    update: { role: WorkerRole.WORKER, active: true },
    create: {
      email: "worker.council@sispaa.local",
      passwordHash: workerPasswordHash,
      role: WorkerRole.WORKER,
      agencyId: council?.id ?? null,
      specializations: ["Public Safety", "General"],
      currentWorkload: 0,
      active: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

