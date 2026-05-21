"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SucursalMapa } from "./page";

function makePinIcon(color: string, glow: boolean): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="28" height="36">
      <defs>
        <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5"/>
        </filter>
      </defs>
      ${glow ? `<circle cx="16" cy="14" r="10" fill="${color}" opacity="0.35" filter="url(#g)"/>` : ""}
      <path d="M16 1 C8.27 1 2 7.27 2 15 c0 9.5 14 23 14 23 s14-13.5 14-23 C30 7.27 23.73 1 16 1 z"
            fill="${color}" stroke="#0f0f10" stroke-width="1.5"/>
      <circle cx="16" cy="14" r="4.5" fill="#0f0f10"/>
    </svg>
  `;
  return L.divIcon({
    className: "safelink-pin",
    html: svg,
    iconSize:   [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

function colorFor(s: SucursalMapa): string {
  if (s.estaciones_total === 0) return "#52525b";
  const pct = (s.estaciones_online / s.estaciones_total) * 100;
  if (pct >= 80) return "#22c55e";
  if (pct >= 40) return "#eab308";
  return "#ef4444";
}

function popupHtml(s: SucursalMapa): string {
  const dir = s.direccion
    ? `<p style="font-size:11px;color:#52525b;margin-bottom:6px;">${escapeHtml(s.direccion)}</p>`
    : "";
  return `
    <div style="min-width:180px;font-family:Inter,sans-serif;">
      <p style="font-size:13px;font-weight:700;margin-bottom:2px;color:#0f0f10;">${escapeHtml(s.nombre)}</p>
      ${dir}
      <p style="font-size:11px;color:#0f0f10;">
        <strong>${s.estaciones_online}</strong> / ${s.estaciones_total} estaciones online
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c));
}

function computeView(sucursales: SucursalMapa[]): { center: [number, number]; zoom: number } {
  if (sucursales.length === 0) return { center: [19.4326, -99.1332], zoom: 5 };
  if (sucursales.length === 1) {
    const s = sucursales[0];
    return { center: [s.lat!, s.lng!], zoom: 13 };
  }
  const lats = sucursales.map(s => s.lat!);
  const lngs = sucursales.map(s => s.lng!);
  const cx = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cy = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  return { center: [cx, cy], zoom: 6 };
}

/**
 * Mapa Leaflet vanilla (sin react-leaflet) para evitar el bug
 * "Map container is already initialized" en React 18 Strict Mode.
 */
export function MapView({
  sucursales,
  selected,
  onSelect,
}: {
  sucursales: SucursalMapa[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Map<string, L.Marker>>(new Map());
  // Refs para que el efecto de mount no dependa de props/handlers cambiantes.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Mount-once: crear mapa + tile layer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    interface LeafletNode extends HTMLDivElement { _leaflet_id?: number }
    const node = el as LeafletNode;
    if (node._leaflet_id) node._leaflet_id = undefined;

    const { center, zoom } = computeView(sucursales);
    const map = L.map(el, { center, zoom, scrollWheelZoom: true });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza markers con la lista de sucursales
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(sucursales.map(s => s.id));
    const existing = markersRef.current;

    // Remover markers de sucursales que ya no estan
    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    // Crear/actualizar markers
    for (const s of sucursales) {
      if (s.lat == null || s.lng == null) continue;
      const color = colorFor(s);
      const isSelected = selected === s.id;
      const icon = makePinIcon(color, isSelected);

      const existingMarker = existing.get(s.id);
      if (existingMarker) {
        existingMarker.setLatLng([s.lat, s.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupHtml(s));
      } else {
        const marker = L.marker([s.lat, s.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml(s));
        marker.on("click", () => onSelectRef.current(s.id));
        existing.set(s.id, marker);
      }
    }
  }, [sucursales, selected]);

  // Fly-to cuando cambia el seleccionado
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const s = sucursales.find(x => x.id === selected);
    if (s?.lat != null && s?.lng != null) {
      map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
      const marker = markersRef.current.get(selected);
      marker?.openPopup();
    }
  }, [selected, sucursales]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#0a0a0c" }}
    />
  );
}
