import { z } from "zod";

import { routingPrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const RoutingSchema = z.object({
  agency: z.enum(["JKR", "Local Council", "Transport Ministry", "AKSB"]),
  reason: z.string().min(1),
});

export async function routingAgent(input: { category: string; intent: string }) {
  return await runGroqJson({
    prompt: routingPrompt(input),
    schema: RoutingSchema,
    fallback: () => ({ agency: "Local Council", reason: "Fallback routing due to AI error." }),
    retries: 2,
    chat: {
      // Routing is small but user-visible; give it a bit more time/retries.
      timeoutMs: 20_000,
      temperature: 0.1,
    },
  });
}

