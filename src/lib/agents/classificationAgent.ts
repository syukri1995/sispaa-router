import { z } from "zod";

import { classificationPrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const ClassificationSchema = z.object({
  category: z.enum(["Road Damage", "Drainage", "Transport", "Public Safety", "General"]),
  reason: z.string().min(1),
});

export async function classificationAgent(input: { title: string; description: string }) {
  return await runGroqJson({
    prompt: classificationPrompt(input),
    schema: ClassificationSchema,
    fallback: () => ({ category: "General", reason: "Fallback classification due to AI error." }),
  });
}

