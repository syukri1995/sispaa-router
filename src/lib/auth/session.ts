import { SignJWT, jwtVerify } from "jose";

import { WorkerRole } from "@/generated/prisma/enums.ts";

export const SESSION_COOKIE_NAME = "sispaa_session";

export type SessionPayload = {
  sub: string;
  role: WorkerRole;
};

function mustGetSecret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET is required");
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(payload: SessionPayload) {
  const secret = mustGetSecret();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = mustGetSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    if (payload.role !== WorkerRole.ADMIN && payload.role !== WorkerRole.WORKER)
      return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

