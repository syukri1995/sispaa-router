import { z } from "zod";

import { routingPrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const RoutingSchema = z.object({
  agency: z.enum(["JKR", "Local Council", "Transport Ministry"]),
  reason: z.string().min(1),
});

export async function routingAgent(input: { category: string; intent: string }) {
  return await runGroqJson({
    prompt: routingPrompt(input),
    schema: RoutingSchema,
    fallback: () => ({ agency: "Local Council", reason: "Fallback routing due to AI error." }),
  });
}

