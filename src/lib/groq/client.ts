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

type Provider = "groq" | "openai";

function getProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? "groq").trim().toLowerCase();
  return raw === "openai" ? "openai" : "groq";
}

function mustGetKey(provider: Provider) {
  const k = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!k) throw new Error(provider === "openai" ? "OPENAI_API_KEY is required" : "GROQ_API_KEY is required");
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
  const provider = getProvider();
  const key = mustGetKey(provider);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const url =
      provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
    const model =
      provider === "openai"
        ? (process.env.OPENAI_MODEL ?? "gpt-4o-mini")
        : (opts.model ?? "llama-3.3-70b-versatile");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 600,
        messages: [
          // Groq requires "json" to appear in messages when using response_format=json_object.
          { role: "system", content: `${opts.system}\n\nReturn a valid JSON object only.` },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const tag = provider === "openai" ? "OpenAI" : "Groq";
      throw new Error(`${tag} HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = await res.json();
    const parsed = GroqChatResponseSchema.safeParse(json);
    if (!parsed.success) throw new Error(provider === "openai" ? "OpenAI response shape invalid" : "Groq response shape invalid");
    const content = parsed.data.choices[0]?.message.content ?? "";
    if (!content) throw new Error(provider === "openai" ? "OpenAI empty content" : "Groq empty content");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

