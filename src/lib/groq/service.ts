import { z } from "zod";

import { groqChatJson } from "@/lib/groq/client";
import { parseWithSchema } from "@/lib/groq/parse";

export async function runGroqJson<T>(opts: {
  prompt: { system: string; user: string };
  schema: z.ZodType<T>;
  fallback: () => T;
  retries?: number;
}): Promise<{ ok: true; data: T } | { ok: false; data: T; error: string }> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await groqChatJson({
        system: opts.prompt.system,
        user: opts.prompt.user,
      });
      const data = parseWithSchema(content, opts.schema);
      return { ok: true, data };
    } catch (e) {
      lastErr = e;
    }
  }

  const fallback = opts.fallback();
  return {
    ok: false,
    data: fallback,
    error: lastErr instanceof Error ? lastErr.message : "groq_failed",
  };
}

