"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "@/lib/leads";

export function scoreColour(score: number) {
  if (score >= 80) return "#2563eb"; // blue-600
  if (score >= 60) return "#60a5fa"; // blue-400
  return "#9ca3af"; // gray-400
}

type Props = {
  centre: { lat: number; lon: number } | null;
  radiusKm: number | null;
  leads: Lead[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
};

const DEFAULT_VIEW: [number, number] = [51.5072, -0.1276]; // London

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function LeadMap({ centre, radiusKm, leads, selectedId, hoveredId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_VIEW, 12);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    // Standard OpenStreetMap tiles (free with attribution; light use per the OSMF tile policy).
    // Desaturated in CSS so the coloured lead markers stand out.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Redraw search area and lead markers when results change.
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    markers.current.clear();
    if (!centre) return;

    if (radiusKm) {
      L.circle([centre.lat, centre.lon], {
        radius: radiusKm * 1000,
        color: "#2563eb",
        weight: 1,
        dashArray: "4 4",
        fillColor: "#3b82f6",
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(g);
    }
    L.circleMarker([centre.lat, centre.lon], {
      radius: 7,
      color: "#ffffff",
      weight: 3,
      fillColor: "#111827",
      fillOpacity: 1,
    })
      .bindTooltip("Your location", { direction: "top", offset: [0, -6] })
      .addTo(g);

    // Draw low scores first so the best leads sit on top.
    [...leads].reverse().forEach((lead) => {
      const mk = L.circleMarker([lead.lat, lead.lon], {
        radius: 6,
        color: "#ffffff",
        weight: 1.5,
        fillColor: scoreColour(lead.score),
        fillOpacity: 0.95,
      })
        .bindTooltip(`<b>${escapeHtml(lead.name)}</b><br/>${escapeHtml(lead.category)} · score ${lead.score}`, {
          direction: "top",
          offset: [0, -6],
        })
        .on("click", () => onSelectRef.current(lead.id))
        .addTo(g);
      markers.current.set(lead.id, mk);
    });

    const bounds = radiusKm
      ? L.latLng(centre.lat, centre.lon).toBounds(radiusKm * 2000)
      : L.latLngBounds(leads.map((l) => [l.lat, l.lon] as [number, number]));
    if (bounds.isValid()) m.fitBounds(bounds, { padding: [24, 24] });
  }, [centre, radiusKm, leads]);

  // Highlight the hovered / selected lead.
  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const active = id === selectedId || id === hoveredId;
      mk.setStyle({ radius: active ? 10 : 6, weight: active ? 3 : 1.5, color: active ? "#111827" : "#ffffff" });
      if (active) mk.bringToFront();
    });
    if (selectedId && map.current) {
      const mk = markers.current.get(selectedId);
      if (mk) {
        map.current.panTo(mk.getLatLng(), { animate: true });
        mk.openTooltip();
      }
    }
  }, [selectedId, hoveredId]);

  return <div ref={el} className="h-full w-full" aria-label="Map of leads" role="region" />;
}
