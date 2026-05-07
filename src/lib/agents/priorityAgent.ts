import { z } from "zod";

import { priorityPrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const PrioritySchema = z.object({
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  reason: z.string().min(1),
});

export async function priorityAgent(input: { title: string; description: string }) {
  return await runGroqJson({
    prompt: priorityPrompt(input),
    schema: PrioritySchema,
    fallback: () => ({ priority: "Medium", reason: "Fallback priority due to AI error." }),
  });
}

