"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SubmitComplaintPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [blob, setBlob] = useState<PutBlobResult | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    title: string;
    locationText: string;
    gps?: { lat: number; lng: number; confidence: number } | null;
  } | null>(null);
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
            setPending(true);
            try {
              const form = new FormData(e.currentTarget);
              const description = String(form.get("description") ?? "");
              if (!description.trim()) {
                setError("missing_description");
                return;
              }

              // Ensure we have an LLM-derived issue title/location from the description.
              let s = suggestion;
              if (!s?.title) {
                setAiPending(true);
                try {
                  const res = await fetch("/api/complaints/extract", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ description }),
                  });
                  if (res.ok) {
                    const data = (await res.json().catch(() => null)) as unknown;
                    if (
                      typeof data === "object" &&
                      data !== null &&
                      "suggestion" in data &&
                      typeof (data as Record<string, unknown>).suggestion === "object" &&
                      (data as Record<string, unknown>).suggestion !== null
                    ) {
                      const raw = (data as Record<string, unknown>).suggestion as Record<string, unknown>;
                      const title = typeof raw.title === "string" ? raw.title : "";
                      const locationText = typeof raw.locationText === "string" ? raw.locationText : "";
                      const gpsRaw = raw.gps;
                      const gps =
                        typeof gpsRaw === "object" &&
                        gpsRaw !== null &&
                        typeof (gpsRaw as Record<string, unknown>).lat === "number" &&
                        typeof (gpsRaw as Record<string, unknown>).lng === "number" &&
                        typeof (gpsRaw as Record<string, unknown>).confidence === "number"
                          ? {
                              lat: (gpsRaw as Record<string, unknown>).lat as number,
                              lng: (gpsRaw as Record<string, unknown>).lng as number,
                              confidence: (gpsRaw as Record<string, unknown>).confidence as number,
                            }
                          : null;
                      s = { title, locationText, gps };
                      setSuggestion(s);
                    }
                  }
                } finally {
                  setAiPending(false);
                }
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
                  title: s?.title?.trim() ? s.title.trim() : "Untitled complaint",
                  description: [
                    description,
                    s?.locationText?.trim() ? `Location: ${s.locationText.trim()}` : null,
                    s?.gps
                      ? `GPS: ${s.gps.lat}, ${s.gps.lng} (conf ${s.gps.confidence})`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                  imageUrls,
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
                    setAiPending(true);
                    try {
                      const res = await fetch("/api/complaints/extract", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ description: text }),
                      });
                      if (!res.ok) return;
                      const data = (await res.json().catch(() => null)) as unknown;
                      if (
                        typeof data === "object" &&
                        data !== null &&
                        "suggestion" in data &&
                        typeof (data as Record<string, unknown>).suggestion === "object" &&
                        (data as Record<string, unknown>).suggestion !== null
                      ) {
                        const raw = (data as Record<string, unknown>).suggestion as Record<string, unknown>;
                        const title = typeof raw.title === "string" ? raw.title : "";
                        const locationText = typeof raw.locationText === "string" ? raw.locationText : "";
                        const gpsRaw = raw.gps;
                        const gps =
                          typeof gpsRaw === "object" &&
                          gpsRaw !== null &&
                          typeof (gpsRaw as Record<string, unknown>).lat === "number" &&
                          typeof (gpsRaw as Record<string, unknown>).lng === "number" &&
                          typeof (gpsRaw as Record<string, unknown>).confidence === "number"
                            ? {
                                lat: (gpsRaw as Record<string, unknown>).lat as number,
                                lng: (gpsRaw as Record<string, unknown>).lng as number,
                                confidence: (gpsRaw as Record<string, unknown>).confidence as number,
                              }
                            : null;
                        setSuggestion({ title, locationText, gps });
                      }
                    } finally {
                      setAiPending(false);
                    }
                  }, 700);
                }}
              />
              <div className="text-xs text-muted-foreground">
                {aiPending
                  ? "AI extracting issue details…"
                  : suggestion?.title
                    ? `Detected: ${suggestion.title}${suggestion.locationText ? ` • ${suggestion.locationText}` : ""}`
                    : "Tip: include a specific landmark for faster routing."}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Evidence image (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" className="block w-full text-sm" />
              {blob ? (
                <div className="text-xs text-muted-foreground">
                  Uploaded: <span className="font-medium">{blob.pathname}</span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Submit failed: {error}
            </div>
          ) : null}

          {trackingId ? (
            <div className="rounded-2xl border bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 px-4 py-4">
              <div className="text-sm font-semibold">Tracking ID</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{trackingId}</div>
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

          <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
            {pending ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </div>
    </div>
  );
}

