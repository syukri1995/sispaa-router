import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { WorkerRole } from "@/generated/prisma/enums";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function requireRole(roles: WorkerRole[]) {
  const session = await getSession();
  if (!session) return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!roles.includes(session.role))
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { ok: true as const, session };
}

