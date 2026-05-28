"use client";

import "leaflet/dist/leaflet.css";

import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { Button } from "@/components/ui/button";

type Gps = { lat: number; lng: number; confidence?: number | null };

const DefaultMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickToSetMarker(props: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      props.onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

async function nominatimSearch(q: string): Promise<Array<{ displayName: string; lat: number; lng: number }>> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim policy: identify the application.
      "accept-language": "en",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => [])) as Array<{ display_name?: string; lat?: string; lon?: string }>;
  return json
    .map((x) => ({
      displayName: String(x.display_name ?? ""),
      lat: Number(x.lat),
      lng: Number(x.lon),
    }))
    .filter((x) => x.displayName && Number.isFinite(x.lat) && Number.isFinite(x.lng));
}

export function MapPickerLeaflet(props: {
  value: Gps | null;
  onChange: (gps: { lat: number; lng: number; confidence: number | null }) => void;
  autoSearchQuery?: string | null;
}) {
  const initial: LatLngExpression = useMemo(() => {
    if (props.value && Number.isFinite(props.value.lat) && Number.isFinite(props.value.lng)) {
      return [props.value.lat, props.value.lng];
    }
    // Default: Kuala Lumpur
    return [3.139, 101.6869];
  }, [props.value]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ displayName: string; lat: number; lng: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pos = props.value ? ([props.value.lat, props.value.lng] as const) : null;

  // Auto-search when the parent provides a detected location string.
  useEffect(() => {
    const q = (props.autoSearchQuery ?? "").trim();
    if (!q) return;
    // If user already pinned, don't override their choice.
    if (props.value && Number.isFinite(props.value.lat) && Number.isFinite(props.value.lng)) return;

    let alive = true;
    const t = window.setTimeout(async () => {
      setQuery(q);
      setErr(null);
      setSearching(true);
      try {
        const out = await nominatimSearch(q);
        if (!alive) return;
        setResults(out);
        if (out[0]) props.onChange({ lat: out[0].lat, lng: out[0].lng, confidence: null });
        if (out.length === 0) setErr("No results found.");
      } finally {
        if (alive) setSearching(false);
      }
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [props.autoSearchQuery, props.onChange, props.value]);

  function FlyToOnPick(props2: { pos: { lat: number; lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
      if (!props2.pos) return;
      map.flyTo([props2.pos.lat, props2.pos.lng], 15, { duration: 0.6 });
    }, [map, props2.pos]);
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium text-foreground/70">Find location</label>
          <input
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gov-blue)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search place / road / landmark"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={searching || !query.trim()}
          onClick={async () => {
            setErr(null);
            setSearching(true);
            try {
              const out = await nominatimSearch(query.trim());
              setResults(out);
              if (out.length === 0) setErr("No results found.");
            } finally {
              setSearching(false);
            }
          }}
        >
          {searching ? "Searching…" : "Search"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setErr(null);
            navigator.geolocation.getCurrentPosition(
              (p) => props.onChange({ lat: p.coords.latitude, lng: p.coords.longitude, confidence: 1 }),
              () => setErr("Could not access location permission."),
              { enableHighAccuracy: true, timeout: 10_000 }
            );
          }}
        >
          Use my location
        </Button>
      </div>

      {err ? <div className="text-xs text-red-700">{err}</div> : null}

      {results.length ? (
        <div className="flex flex-wrap gap-2">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lng},${r.displayName}`}
              type="button"
              className="rounded-full border bg-white/70 px-3 py-1 text-left text-xs shadow-sm transition hover:bg-white"
              onClick={() => props.onChange({ lat: r.lat, lng: r.lng, confidence: null })}
              title={r.displayName}
            >
              <span className="line-clamp-1 max-w-[38ch]">{r.displayName}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white/60 shadow-sm">
        <MapContainer center={initial} zoom={13} scrollWheelZoom className="h-64 w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickToSetMarker onPick={(p) => props.onChange({ lat: p.lat, lng: p.lng, confidence: null })} />

          <FlyToOnPick pos={pos ? { lat: pos[0], lng: pos[1] } : null} />

          {pos ? <Marker position={pos} icon={DefaultMarkerIcon} draggable={false} /> : null}
        </MapContainer>
      </div>

      <div className="text-xs text-muted-foreground">
        Tip: click on the map to drop the pin. You can refine later before final submission.
      </div>
    </div>
  );
}

