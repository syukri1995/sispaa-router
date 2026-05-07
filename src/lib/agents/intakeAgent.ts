import { z } from "zod";

import { intakePrompt } from "@/lib/groq/prompts";
import { runGroqJson } from "@/lib/groq/service";

const IntakeSchema = z.object({
  intent: z.string().min(1),
  summary: z.string().min(1),
  suggestedTitle: z.string().min(1),
  locationText: z.string().nullable(),
  gps: z
    .object({
      lat: z.number(),
      lng: z.number(),
      confidence: z.number().min(0).max(1),
    })
    .nullable(),
});

export async function intakeAgent(input: { title: string; description: string }) {
  return await runGroqJson({
    prompt: intakePrompt(input),
    schema: IntakeSchema,
    fallback: () => ({
      intent: "General complaint",
      summary: input.description.slice(0, 200),
      suggestedTitle: input.title || "Public complaint",
      locationText: null,
      gps: null,
    }),
  });
}

