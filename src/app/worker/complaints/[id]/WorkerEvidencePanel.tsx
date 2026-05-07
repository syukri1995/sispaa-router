"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function WorkerEvidencePanel(props: { complaintId: string; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [blob, setBlob] = useState<PutBlobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <div className="rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
      <div className="text-sm font-semibold">Work evidence</div>
      <div className="mt-1 text-sm text-muted-foreground">
        Upload at least one “after” photo and briefly describe what you fixed. AI uses this to verify resolution.
      </div>

      <div className="mt-4 grid gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Evidence image</label>
          <input ref={fileRef} type="file" accept="image/*" className="block w-full text-sm" disabled={props.disabled} />
          {blob ? (
            <div className="text-xs text-muted-foreground">
              Uploaded: <span className="font-medium">{blob.pathname}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Worker note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-20 w-full rounded-xl border bg-white p-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[color:var(--gov-blue)]"
            placeholder="Example: Filled pothole with cold mix asphalt, compacted area, placed warning cone for curing."
            disabled={props.disabled}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {ok ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Evidence saved. You can now mark the job as resolved.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={props.disabled || pending}
            onClick={async () => {
              setError(null);
              setOk(false);
              setPending(true);
              try {
                const file = fileRef.current?.files?.[0] ?? null;
                if (!file) {
                  setError("Please choose an evidence image first.");
                  return;
                }

                let uploaded: PutBlobResult;
                try {
                  uploaded = await upload(file.name, file, {
                    access: "private",
                    handleUploadUrl: "/api/uploads/blob",
                  });
                  setBlob(uploaded);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "blob_upload_failed";
                  setError(
                    msg.includes("client token")
                      ? "Upload failed: missing/invalid Blob token. Set BLOB_READ_WRITE_TOKEN in .env (or Vercel env vars), then restart dev server."
                      : `Upload failed: ${msg}`
                  );
                  return;
                }

                const res = await fetch(`/api/complaints/${props.complaintId}/evidence`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ imageUrls: [uploaded.url], note }),
                });
                const data = (await res.json().catch(() => null)) as unknown;
                if (!res.ok) {
                  const err =
                    typeof data === "object" &&
                    data !== null &&
                    "error" in data &&
                    typeof (data as Record<string, unknown>).error === "string"
                      ? ((data as Record<string, unknown>).error as string)
                      : "evidence_upload_failed";
                  setError(err);
                  return;
                }
                setOk(true);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Saving…" : "Upload & save evidence"}
          </Button>
        </div>
      </div>
    </div>
  );
}

