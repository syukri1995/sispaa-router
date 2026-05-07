"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function TrackForm({ initial }: { initial: string }) {
  const [trackingId, setTrackingId] = useState(initial);
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trackingId) return;
        router.push(`/track?trackingId=${encodeURIComponent(trackingId)}`);
      }}
    >
      <input
        value={trackingId}
        onChange={(e) => setTrackingId(e.target.value)}
        className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
        placeholder="SIS-XXXXXXXX"
      />
      <Button type="submit">Track</Button>
    </form>
  );
}

