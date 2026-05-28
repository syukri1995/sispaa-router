export type AutoSuggestion = {
  title: string;
  locationText: string;
};

const LOCATION_HINTS = [
  // English
  "at",
  "near",
  "in",
  "around",
  "beside",
  "opposite",
  "outside",
  "behind",
  "front of",
  // Malay
  "di",
  "dekat",
  "sekitar",
  "berhampiran",
  "sebelah",
  "hadapan",
  "belakang",
];

const PLACE_TOKENS = [
  "jalan",
  "jln",
  "lorong",
  "taman",
  "kg",
  "kampung",
  "persiaran",
  "lebuhraya",
  "lebuh raya",
  "highway",
  "exit",
  "susur",
  "lrt",
  "mrt",
  "stesen",
  "station",
  "sk",
  "smk",
  "sekolah",
  "hospital",
  "klinik",
  "masjid",
  "surau",
  "balai",
  "polis",
];

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function looksLikePlace(s: string) {
  const t = s.toLowerCase();
  if (t.length < 3) return false;
  if (/(^|\s)\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(s)) return false; // time-ish
  if (/\b(today|yesterday|tonight|pagi|tengahari|petang|malam)\b/i.test(s)) return false;
  if (/\b(home|house|rumah)\b/i.test(s)) return false;
  if (PLACE_TOKENS.some((p) => t.includes(p))) return true;
  if (/[A-Z][a-z]+/.test(s)) return true; // has some proper-noun-ish casing
  if (/\d/.test(s) && /\b(jalan|jln|lorong|km|exit)\b/i.test(s)) return true;
  return t.split(" ").length >= 2;
}

export function extractLocationText(description: string) {
  const text = clean(description);
  if (!text) return "";

  // Split into clauses to avoid swallowing too much.
  const clauses = text.split(/[.\n;]+/g).map(clean).filter(Boolean);

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    for (const hint of LOCATION_HINTS) {
      const idx = lower.indexOf(` ${hint} `);
      const start = idx >= 0 ? idx + hint.length + 2 : lower.startsWith(`${hint} `) ? hint.length + 1 : -1;
      if (start < 0) continue;

      let span = clause.slice(start);
      // stop at common separators
      span = span.split(/,| but | and | kerana | sebab | since | because | yang | untuk | with | tanpa /i)[0] ?? span;
      span = clean(span);
      if (span.length > 80) span = clean(span.slice(0, 80));
      if (looksLikePlace(span)) return span;
    }
  }

  return "";
}

export function suggestTitle(description: string, locationText?: string) {
  const t = description.toLowerCase();
  const loc = locationText && locationText.trim() ? ` at ${locationText.trim()}` : "";

  const pick = (base: string) => `${base}${loc}`;

  if (/\b(pothole|jalan berlubang|lubang jalan|sinkhole)\b/i.test(t)) return pick("Pothole");
  if (/\b(road crack|retak|jalan rosak|road damage)\b/i.test(t)) return pick("Road damage");
  if (/\b(longkang|drain|clog|tersumbat)\b/i.test(t)) return pick("Drainage blockage");
  if (/\b(flood|banjir|air naik)\b/i.test(t)) return pick("Flooding");
  if (/\b(traffic light|lampu isyarat)\b/i.test(t)) return pick("Traffic light issue");
  if (/\b(street ?light|lampu jalan)\b/i.test(t)) return pick("Streetlight issue");
  if (/\b(accident|kemalangan)\b/i.test(t)) return pick("Traffic hazard");
  if (/\b(garbage|sampah)\b/i.test(t)) return pick("Public cleanliness issue");

  return pick("Public complaint");
}

export function buildAutoSuggestion(description: string): AutoSuggestion | null {
  const d = clean(description);
  if (d.length < 8) return null;
  const locationText = extractLocationText(d);
  const title = suggestTitle(d, locationText);
  return { title, locationText };
}

