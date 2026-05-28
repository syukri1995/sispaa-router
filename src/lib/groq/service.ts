import { z } from "zod";

import { groqChatJson } from "@/lib/groq/client";
import { parseWithSchema } from "@/lib/groq/parse";

export async function runGroqJson<T>(opts: {
  prompt: { system: string; user: string };
  schema: z.ZodType<T>;
  fallback: () => T;
  retries?: number;
  chat?: {
    model?: Parameters<typeof groqChatJson>[0]["model"];
    temperature?: Parameters<typeof groqChatJson>[0]["temperature"];
    maxTokens?: Parameters<typeof groqChatJson>[0]["maxTokens"];
    timeoutMs?: Parameters<typeof groqChatJson>[0]["timeoutMs"];
  };
}): Promise<{ ok: true; data: T } | { ok: false; data: T; error: string }> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const content = await groqChatJson({
        system: opts.prompt.system,
        user: opts.prompt.user,
        model: opts.chat?.model,
        temperature: opts.chat?.temperature,
        maxTokens: opts.chat?.maxTokens,
        timeoutMs: opts.chat?.timeoutMs,
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

