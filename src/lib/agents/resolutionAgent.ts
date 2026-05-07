import { z } from "zod";

import { resolutionPrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const ResolutionSchema = z.object({
  resolved: z.boolean(),
  reason: z.string().min(1),
  missing: z.array(z.string()).default([]),
});

export async function resolutionAgent(input: {
  title: string;
  description: string;
  workerNote?: string | null;
  evidenceUrls: string[];
}) {
  return await runGroqJson({
    prompt: resolutionPrompt(input),
    schema: ResolutionSchema,
    fallback: () => ({
      resolved: false,
      reason: "AI resolution check unavailable (fallback).",
      missing: ["clear evidence photo", "worker note describing what was fixed"],
    }),
    retries: 1,
  });
}

