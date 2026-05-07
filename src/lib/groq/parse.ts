import { z } from "zod";

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some models occasionally wrap JSON in text. Best-effort extract.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function parseWithSchema<T>(text: string, schema: z.ZodType<T>): T {
  const json = safeJsonParse(text);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

