"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { MapPickerLeaflet } from "@/components/complaint/MapPickerLeaflet";
import { computePHashFromFile } from "@/lib/image/phashClient";
import { buildAutoSuggestion } from "@/lib/text/autoSuggestion";

type Preview = {
  title: string;
  description: string;
  summary: string;
  intent: string;
  locationText: string | null;
  gps: { lat: number; lng: number; confidence: number | null } | null;
  category: string;
  severity: string;
  agencyCode: "JKR" | "MOT" | "COUNCIL" | "AKSB";
  reasons: { category: string; severity: string; agency: string };
};

type DedupMatch = {
  complaintId: string;
  trackingId: string;
  title: string;
  status: string;
  priority: string;
  agencyName: string | null;
  distanceM: number | null;
  createdAt: string | Date;
  score: number;
  signals: { distance: number; text: number; image: number };
};

export default function SubmitComplaintPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    agency: { code: string; name: string } | null;
    severity: string | null;
    gps: { lat: number; lng: number; confidence: number | null } | null;
  } | null>(null);
  const [blob, setBlob] = useState<PutBlobResult | null>(null);
  const [suggestion, setSuggestion] = useState<{
    title: string;
    locationText: string;
    gps?: { lat: number; lng: number; confidence: number } | null;
  } | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [icNumber, setIcNumber] = useState("");
  const [imagePhashes, setImagePhashes] = useState<string[]>([]);
  const [dedupPending, setDedupPending] = useState(false);
  const [dedupMatches, setDedupMatches] = useState<DedupMatch[]>([]);
  const [dedupOverride, setDedupOverride] = useState(false);
  const [dedupOverrideReason, setDedupOverrideReason] = useState("");
  const aiTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        title="Submit complaint"
        description="No login required. Your complaint will be auto-classified, routed, and assigned."
        actions={[{ label: "Track", href: "/track", variant: "outline" }]}
      />

      <div className="mt-6 rounded-2xl border bg-white/70 p-6 shadow-lg backdrop-blur">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border bg-white/60 p-4 backdrop-blur">
          <div className="mt-0.5 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 p-2 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI assistance enabled</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Intake, classification, priority, routing, and workforce assignment run automatically after submission.
            </div>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setTrackingId(null);
            setResultMeta(null);
            setPending(true);
            try {
              const form = new FormData(e.currentTarget);
              const description = String(form.get("description") ?? "");
              if (!description.trim()) {
                setError("missing_description");
                return;
              }
              if (!preview) {
                setError("generate_preview_first");
                return;
              }
              if (dedupMatches.length > 0 && !dedupOverride) {
                setError("possible_duplicate");
                return;
              }
              if (!icNumber.trim()) {
                setError("missing_ic");
                return;
              }

              let imageUrls: string[] = [];
              if (fileRef.current?.files?.[0]) {
                const file = fileRef.current.files[0];
                const uploaded = await upload(file.name, file, {
                  access: "private",
                  handleUploadUrl: "/api/uploads/blob",
                });
                setBlob(uploaded);
                imageUrls = [uploaded.url];
              }

              const res = await fetch("/api/complaints", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  title: preview.title,
                  description,
                  imageUrls,
                  imagePhashes,
                  gps: preview.gps,
                  locationText: preview.locationText,
                  category: preview.category,
                  severity: preview.severity,
                  agencyCode: preview.agencyCode,
                  ai: {
                    summary: preview.summary,
                    intent: preview.intent,
                    reasons: preview.reasons,
                  },
                  icNumber,
                  dedup: dedupOverride
                    ? { override: true, overrideReason: dedupOverrideReason.trim() || "user_override" }
                    : { override: false },
                }),
              });
              const data = (await res.json().catch(() => null)) as unknown;
              if (!res.ok) {
                const err =
                  typeof data === "object" &&
                  data !== null &&
                  "error" in data &&
                  typeof (data as Record<string, unknown>).error === "string"
                    ? ((data as Record<string, unknown>).error as string)
                    : "submit_failed";
                setError(err);
                return;
              }
              const tid =
                typeof data === "object" &&
                data !== null &&
                "trackingId" in data &&
                typeof (data as Record<string, unknown>).trackingId === "string"
                  ? ((data as Record<string, unknown>).trackingId as string)
                  : null;
              if (!tid) {
                setError("invalid_response");
                return;
              }
              setTrackingId(tid);
              const agency =
                typeof data === "object" &&
                data !== null &&
                "agency" in data &&
                typeof (data as Record<string, unknown>).agency === "object" &&
                (data as Record<string, unknown>).agency !== null &&
                "code" in ((data as Record<string, unknown>).agency as Record<string, unknown>) &&
                "name" in ((data as Record<string, unknown>).agency as Record<string, unknown>) &&
                typeof (((data as Record<string, unknown>).agency as Record<string, unknown>).code as unknown) ===
                  "string" &&
                typeof (((data as Record<string, unknown>).agency as Record<string, unknown>).name as unknown) ===
                  "string"
                  ? {
                      code: ((data as Record<string, unknown>).agency as Record<string, unknown>).code as string,
                      name: ((data as Record<string, unknown>).agency as Record<string, unknown>).name as string,
                    }
                  : null;
              const severity =
                typeof data === "object" &&
                data !== null &&
                "severity" in data &&
                typeof (data as Record<string, unknown>).severity === "string"
                  ? ((data as Record<string, unknown>).severity as string)
                  : null;
              const gps =
                typeof data === "object" &&
                data !== null &&
                "gps" in data &&
                typeof (data as Record<string, unknown>).gps === "object" &&
                (data as Record<string, unknown>).gps !== null &&
                "lat" in ((data as Record<string, unknown>).gps as Record<string, unknown>) &&
                "lng" in ((data as Record<string, unknown>).gps as Record<string, unknown>) &&
                typeof (((data as Record<string, unknown>).gps as Record<string, unknown>).lat as unknown) ===
                  "number" &&
                typeof (((data as Record<string, unknown>).gps as Record<string, unknown>).lng as unknown) ===
                  "number"
                  ? {
                      lat: ((data as Record<string, unknown>).gps as Record<string, unknown>).lat as number,
                      lng: ((data as Record<string, unknown>).gps as Record<string, unknown>).lng as number,
                      confidence:
                        "confidence" in ((data as Record<string, unknown>).gps as Record<string, unknown>) &&
                        typeof (((data as Record<string, unknown>).gps as Record<string, unknown>).confidence as
                          | unknown
                          | null) === "number"
                          ? (((data as Record<string, unknown>).gps as Record<string, unknown>).confidence as number)
                          : null,
                    }
                  : null;
              setResultMeta({ agency, severity, gps });
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Describe the issue</label>
              <textarea
                name="description"
                className="min-h-32 w-full rounded-xl border bg-white p-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[color:var(--gov-blue)]"
                placeholder="Tell us what happened, where it happened, and any safety risk. Example: “Large pothole near LRT entrance at Taman Melati; two motorcycles nearly fell.”"
                required
                onChange={(e) => {
                  const text = e.target.value;
                  if (aiTimer.current) window.clearTimeout(aiTimer.current);
                  aiTimer.current = window.setTimeout(async () => {
                    if (!text.trim()) return;
                    const s = buildAutoSuggestion(text);
                    if (!s) return;
                    setSuggestion({ title: s.title, locationText: s.locationText, gps: null });
                  }, 700);
                }}
              />
              <div className="text-xs text-muted-foreground">
                {suggestion?.title
                  ? `Detected: ${suggestion.title}${suggestion.locationText ? ` • ${suggestion.locationText}` : ""}`
                  : "Tip: include a specific landmark for faster routing."}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewPending}
                  onClick={async () => {
                    setError(null);
                    setPreview(null);
                    setEditMode(false);
                    const text = (document.querySelector("textarea[name='description']") as HTMLTextAreaElement | null)
                      ?.value;
                    const desc = (text ?? "").trim();
                    if (!desc) {
                      setError("missing_description");
                      return;
                    }
                    setPreviewPending(true);
                    try {
                      const res = await fetch("/api/complaints/preview", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          description: desc,
                          title: suggestion?.title ?? "",
                          gps: suggestion?.gps ?? null,
                        }),
                      });
                      const data = (await res.json().catch(() => null)) as unknown;
                      if (!res.ok) {
                        const err =
                          typeof data === "object" &&
                          data !== null &&
                          "error" in data &&
                          typeof (data as Record<string, unknown>).error === "string"
                            ? ((data as Record<string, unknown>).error as string)
                            : "preview_failed";
                        setError(err);
                        return;
                      }
                      const p =
                        typeof data === "object" &&
                        data !== null &&
                        "preview" in data &&
                        typeof (data as Record<string, unknown>).preview === "object" &&
                        (data as Record<string, unknown>).preview !== null
                          ? ((data as Record<string, unknown>).preview as Preview)
                          : null;
                      if (!p) {
                        setError("invalid_preview_response");
                        return;
                      }
                      setPreview(p);
                    } finally {
                      setPreviewPending(false);
                    }
                  }}
                >
                  {previewPending ? "Generating…" : "Generate details"}
                </Button>

                {preview ? (
                  <Button type="button" variant="outline" onClick={() => setEditMode((v) => !v)}>
                    {editMode ? "Done editing" : "Edit details"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Evidence image (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="block w-full text-sm"
                onChange={async (e) => {
                  const f = e.currentTarget.files?.[0] ?? null;
                  setImagePhashes([]);
                  if (!f) return;
                  try {
                    const { phash } = await computePHashFromFile(f);
                    setImagePhashes([phash]);
                  } catch {
                    // If hashing fails, continue without image matching.
                    setImagePhashes([]);
                  }
                }}
              />
              {blob ? (
                <div className="text-xs text-muted-foreground">
                  Uploaded: <span className="font-medium">{blob.pathname}</span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error === "possible_duplicate"
                ? "Possible duplicate detected. Please open the existing ticket or choose Submit anyway."
                : `Submit failed: ${error}`}
            </div>
          ) : null}

          {preview ? (
            <div className="rounded-2xl border bg-white/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Review before submission</div>
                <div className="text-xs text-muted-foreground">Editable chips</div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Agency</div>
                  {editMode ? (
                    <select
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                      value={preview.agencyCode}
                      onChange={(e) =>
                        setPreview((p) => (p ? { ...p, agencyCode: e.target.value as Preview["agencyCode"] } : p))
                      }
                    >
                      <option value="JKR">JKR</option>
                      <option value="COUNCIL">COUNCIL</option>
                      <option value="MOT">MOT</option>
                      <option value="AKSB">AKSB</option>
                    </select>
                  ) : (
                    <div className="mt-0.5 font-medium text-foreground">{preview.agencyCode}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{preview.reasons.agency}</div>
                </div>
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Severity</div>
                  {editMode ? (
                    <select
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                      value={preview.severity}
                      onChange={(e) => setPreview((p) => (p ? { ...p, severity: e.target.value } : p))}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  ) : (
                    <div className="mt-0.5 font-medium text-foreground">{preview.severity}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{preview.reasons.severity}</div>
                </div>
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Category</div>
                  {editMode ? (
                    <select
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                      value={preview.category}
                      onChange={(e) => setPreview((p) => (p ? { ...p, category: e.target.value } : p))}
                    >
                      <option value="Road Damage">Road Damage</option>
                      <option value="Drainage">Drainage</option>
                      <option value="Transport">Transport</option>
                      <option value="Public Safety">Public Safety</option>
                      <option value="General">General</option>
                    </select>
                  ) : (
                    <div className="mt-0.5 font-medium text-foreground">{preview.category}</div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{preview.reasons.category}</div>
                </div>
              </div>

              {/* Duplicate check panel */}
              <div className="mt-3 rounded-2xl border bg-white/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Possible duplicate nearby</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      We check nearby recent reports using location, text, and photo similarity (if provided).
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={dedupPending}
                    onClick={async () => {
                      setDedupPending(true);
                      setDedupMatches([]);
                      setDedupOverride(false);
                      setDedupOverrideReason("");
                      try {
                        const res = await fetch("/api/complaints/dedup-check", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            title: preview.title,
                            description: preview.description,
                            category: preview.category,
                            severity: preview.severity,
                            agencyCode: preview.agencyCode,
                            locationText: preview.locationText,
                            gps: preview.gps ? { lat: preview.gps.lat, lng: preview.gps.lng } : null,
                            imagePhashes,
                          }),
                        });
                        const data = (await res.json().catch(() => null)) as unknown;
                        const matches =
                          typeof data === "object" &&
                          data !== null &&
                          "matches" in data &&
                          Array.isArray((data as Record<string, unknown>).matches)
                            ? ((data as Record<string, unknown>).matches as DedupMatch[])
                            : [];
                        setDedupMatches(matches);
                      } finally {
                        setDedupPending(false);
                      }
                    }}
                  >
                    {dedupPending ? "Checking…" : "Check duplicates"}
                  </Button>
                </div>

                {dedupMatches.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    No strong duplicates found{imagePhashes.length ? " (including photo match)" : ""}.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {dedupMatches.map((m) => {
                      const strong = m.score >= 0.85;
                      return (
                        <div key={m.complaintId} className="rounded-xl border bg-white/80 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                {m.trackingId}{" "}
                                <span className="font-normal text-muted-foreground">· score {m.score}</span>
                              </div>
                              <div className="mt-0.5 truncate text-sm text-muted-foreground">{m.title}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {m.agencyName ?? "Agency pending"}
                                {typeof m.distanceM === "number" ? ` · ${m.distanceM}m away` : ""}
                                {" · "}
                                signals: d {m.signals.distance}, t {m.signals.text}
                                {imagePhashes.length ? `, i ${m.signals.image}` : ""}
                                {strong ? " · very likely same issue" : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className={strong ? "h-10" : "h-10"}
                                onClick={() => {
                                  router.push(`/track?trackingId=${encodeURIComponent(m.trackingId)}`);
                                }}
                              >
                                Open existing
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="rounded-xl border bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Submit anyway</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Only do this if the report is genuinely different (e.g., same road but different pothole).
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={dedupOverride}
                            onChange={(e) => setDedupOverride(e.target.checked)}
                          />
                          Override
                        </label>
                      </div>
                      {dedupOverride ? (
                        <input
                          className="mt-2 w-full rounded-md border bg-white px-2 py-1 text-sm"
                          value={dedupOverrideReason}
                          onChange={(e) => setDedupOverrideReason(e.target.value)}
                          placeholder="Reason (e.g. different pothole, different side of road)"
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Title</div>
                  {editMode ? (
                    <input
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                      value={preview.title}
                      onChange={(e) => setPreview((p) => (p ? { ...p, title: e.target.value } : p))}
                    />
                  ) : (
                    <div className="mt-0.5 font-medium text-foreground">{preview.title}</div>
                  )}
                </div>
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Location</div>
                  {editMode ? (
                    <input
                      className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                      value={preview.locationText ?? ""}
                      onChange={(e) => setPreview((p) => (p ? { ...p, locationText: e.target.value } : p))}
                      placeholder="e.g. Jalan Tun Razak, KL"
                    />
                  ) : (
                    <div className="mt-0.5 font-medium text-foreground">
                      {preview.locationText?.trim() ? preview.locationText : "Not set"}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {preview.gps ? `${preview.gps.lat.toFixed(6)}, ${preview.gps.lng.toFixed(6)}` : "No coordinates yet"}
                  </div>
                </div>
              </div>

              <div className="mt-2 rounded-2xl border bg-white/70 p-3">
                <div className="text-xs font-medium text-foreground/70">Pin-point location</div>
                <div className="mt-2">
                  <MapPickerLeaflet
                    value={
                      preview.gps
                        ? { lat: preview.gps.lat, lng: preview.gps.lng, confidence: preview.gps.confidence ?? null }
                        : null
                    }
                    onChange={(gps) => setPreview((p) => (p ? { ...p, gps } : p))}
                    autoSearchQuery={preview.locationText}
                  />
                </div>
              </div>

              <div className="mt-2 rounded-xl border bg-white/70 px-3 py-2">
                <div className="text-xs font-medium text-foreground/70">AI summary</div>
                {editMode ? (
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border bg-white px-2 py-1 text-sm"
                    value={preview.summary}
                    onChange={(e) => setPreview((p) => (p ? { ...p, summary: e.target.value } : p))}
                  />
                ) : (
                  <div className="mt-1 text-sm text-foreground/90">{preview.summary}</div>
                )}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">IC number (verification)</div>
                  <input
                    className="mt-1 w-full rounded-md border bg-white px-2 py-1 text-sm"
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="e.g. 900101-14-5678"
                    inputMode="numeric"
                  />
                  <div className="mt-1 text-xs text-muted-foreground">
                    Your IC is required to submit. We store only a hashed form.
                  </div>
                </div>
                <div className="rounded-xl border bg-white/70 px-3 py-2">
                  <div className="text-xs font-medium text-foreground/70">Ready to submit</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    When you press Submit, the report will be routed to the selected agency.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {trackingId ? (
            <div className="rounded-2xl border bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 px-4 py-4">
              <div className="text-sm font-semibold">Tracking ID</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{trackingId}</div>
              {resultMeta ? (
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <div className="rounded-xl border bg-white/60 px-3 py-2">
                    <div className="text-xs font-medium text-foreground/70">Agency</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {resultMeta.agency ? `${resultMeta.agency.name} (${resultMeta.agency.code})` : "Unassigned"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white/60 px-3 py-2">
                    <div className="text-xs font-medium text-foreground/70">Severity</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {resultMeta.severity ?? "Unknown"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white/60 px-3 py-2">
                    <div className="text-xs font-medium text-foreground/70">Coordinates</div>
                    <div className="mt-0.5 font-medium text-foreground">
                      {resultMeta.gps
                        ? `${resultMeta.gps.lat.toFixed(6)}, ${resultMeta.gps.lng.toFixed(6)}${
                            resultMeta.gps.confidence !== null
                              ? ` (conf ${resultMeta.gps.confidence.toFixed(2)})`
                              : ""
                          }`
                        : "Not detected"}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/track?trackingId=${encodeURIComponent(trackingId)}`}>Track now</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/">Back to home</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <Button type="submit" disabled={pending || !preview} size="lg" className="w-full sm:w-auto">
            {pending ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </div>
    </div>
  );
}

