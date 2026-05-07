import { z } from "zod";

const GroqChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
        }),
      })
    )
    .min(1),
});

export type GroqModel =
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant"
  | "mixtral-8x7b-32768";

function mustGetKey() {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY is required");
  return k;
}

export async function groqChatJson(opts: {
  system: string;
  user: string;
  model?: GroqModel;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const key = mustGetKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? "llama-3.3-70b-versatile",
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 600,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json();
    const parsed = GroqChatResponseSchema.safeParse(json);
    if (!parsed.success) throw new Error("Groq response shape invalid");
    const content = parsed.data.choices[0]?.message.content ?? "";
    if (!content) throw new Error("Groq empty content");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

