export const groqSystemJsonOnly = `You are an expert Malaysian GovTech operations AI.\nReturn ONLY valid JSON. No markdown. No extra keys.\nUse concise English.\n`;

export function intakePrompt(input: { title: string; description: string }) {
  return {
    system: groqSystemJsonOnly,
    user: `Extract intent and summarize this public complaint. Also extract a suggested title and location.\n\nReturn JSON:\n{\n  \"intent\": string,\n  \"summary\": string,\n  \"suggestedTitle\": string,\n  \"locationText\": string | null,\n  \"gps\": { \"lat\": number, \"lng\": number, \"confidence\": number } | null\n}\n\nRules:\n- If location not present, return locationText=null and gps=null.\n- Only return GPS if the user wrote explicit coordinates (e.g. \"3.1390, 101.6869\").\n- confidence is 0..1.\n\nComplaint:\nTitle: ${input.title}\nDescription: ${input.description}\n`,
  };
}

export function classificationPrompt(input: { title: string; description: string }) {
  return {
    system: groqSystemJsonOnly,
    user: `Classify complaint into one category.\nCategories: [\"Road Damage\",\"Drainage\",\"Transport\",\"Public Safety\",\"General\"]\n\nReturn JSON:\n{\n  \"category\": string,\n  \"reason\": string\n}\n\nComplaint:\nTitle: ${input.title}\nDescription: ${input.description}\n`,
  };
}

export function priorityPrompt(input: { title: string; description: string }) {
  return {
    system: groqSystemJsonOnly,
    user: `Determine urgency priority.\nPriorities: [\"Low\",\"Medium\",\"High\",\"Critical\"]\n\nReturn JSON:\n{\n  \"priority\": string,\n  \"reason\": string\n}\n\nComplaint:\nTitle: ${input.title}\nDescription: ${input.description}\n`,
  };
}

export function routingPrompt(input: { category: string; intent: string }) {
  return {
    system: groqSystemJsonOnly,
    user: `Select the most appropriate government agency.\nAgencies: [\"JKR\",\"Local Council\",\"Transport Ministry\",\"AKSB\"]\n\nReturn JSON:\n{\n  \"agency\": string,\n  \"reason\": string\n}\n\nContext:\nCategory: ${input.category}\nIntent: ${input.intent}\n`,
  };
}

export function resolutionPrompt(input: {
  title: string;
  description: string;
  workerNote?: string | null;
  evidenceUrls: string[];
}) {
  return {
    system: groqSystemJsonOnly,
    user: `You are verifying whether a worker has actually resolved a complaint.

Return JSON:
{
  "resolved": boolean,
  "reason": string,
  "missing": string[]
}

Rules:
- If evidence is missing or too weak, set resolved=false and list what is missing in "missing".
- Evidence is provided as URLs (you cannot open them). Use the worker note + the presence/number of evidence URLs as signals.
- Be strict: do not approve unless the note clearly states what was fixed and evidence is present.
- Keep "reason" concise and actionable for the worker.

Complaint:
Title: ${input.title}
Description: ${input.description}

Worker note:
${(input.workerNote ?? "").trim() || "(none)"}

Evidence URLs (${input.evidenceUrls.length}):
${input.evidenceUrls.map((u) => `- ${u}`).join("\n") || "(none)"}
`,
  };
}

