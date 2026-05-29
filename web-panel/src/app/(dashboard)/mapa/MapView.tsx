"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SucursalMapa } from "./page";

/**
 * Pin custom Safe Link:
 *  - Anillo exterior de color del estado (online verde, warn amber, etc)
 *  - Punto central indicando "ubicacion"
 *  - Pulse animado (CSS) cuando el pin esta seleccionado o online
 */
function makePinIcon(color: string, opts: { selected?: boolean; pulse?: boolean; count?: number } = {}): L.DivIcon {
  const { selected, pulse, count } = opts;
  const size = selected ? 38 : 30;
  const html = `
    <div class="sl-pin ${pulse ? "sl-pin--pulse" : ""} ${selected ? "sl-pin--selected" : ""}"
         style="--sl-pin-color: ${color}; width: ${size}px; height: ${size}px;">
      ${pulse ? '<span class="sl-pin__halo" aria-hidden="true"></span>' : ""}
      <span class="sl-pin__ring"></span>
      <span class="sl-pin__core"></span>
      ${count != null ? `<span class="sl-pin__count">${count}</span>` : ""}
    </div>
  `;
  return L.divIcon({
    className: "safelink-pin",
    html,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
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
    ? `<p style="font-size:11px;color:var(--text-muted);margin-bottom:6px;line-height:1.45;">${escapeHtml(s.direccion)}</p>`
    : "";
  const btns = `
    <div style="margin-top:10px;display:flex;gap:6px;">
      <a href="/dispositivos?search=${encodeURIComponent(s.nombre)}" class="popup-btn popup-btn--primary">
        Ver estaciones
      </a>
      <a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" rel="noopener noreferrer" class="popup-btn">
        Maps ↗
      </a>
    </div>
  `;
  return `
    <div style="min-width:190px;font-family:Inter,sans-serif;padding:2px 0;">
      <p style="font-size:13px;font-weight:700;margin-bottom:4px;color:var(--text-primary);">${escapeHtml(s.nombre)}</p>
      ${dir}
      <p style="font-size:11.5px;color:var(--text-secondary);margin-top:4px;">
        <strong style="color:var(--text-primary);">${s.estaciones_online}</strong> / ${s.estaciones_total} en línea
      </p>
      ${btns}
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

export type MapViewHandle = {
  fitToAll: () => void;
};

/**
 * Mapa Leaflet vanilla (sin react-leaflet) para evitar el bug
 * "Map container is already initialized" en React 18 Strict Mode.
 */
export function MapView({
  sucursales,
  selected,
  onSelect,
  onReady,
}: {
  sucursales: SucursalMapa[];
  selected: string | null;
  onSelect: (id: string) => void;
  onReady?: (handle: MapViewHandle) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Map<string, L.Marker>>(new Map());
  // Refs para que el efecto de mount no dependa de props/handlers cambiantes.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onReadyRef  = useRef(onReady);
  onReadyRef.current = onReady;
  const sucursalesRef = useRef(sucursales);
  sucursalesRef.current = sucursales;

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

    // Expone handle al padre con utilidades del mapa.
    onReadyRef.current?.({
      fitToAll: () => {
        const list = sucursalesRef.current.filter(s => s.lat != null && s.lng != null);
        if (list.length === 0) return;
        if (list.length === 1) {
          map.flyTo([list[0].lat!, list[0].lng!], 14, { duration: 0.6 });
          return;
        }
        const bounds = L.latLngBounds(list.map(s => [s.lat!, s.lng!] as [number, number]));
        map.flyToBounds(bounds, { padding: [60, 60], duration: 0.6, maxZoom: 14 });
      },
    });

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
      const isOnline   = s.estaciones_total > 0 && s.estaciones_online === s.estaciones_total;
      const icon = makePinIcon(color, {
        selected: isSelected,
        pulse:    isOnline || isSelected,
        count:    s.estaciones_total > 1 ? s.estaciones_total : undefined,
      });

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
      className="mapa-frame__canvas"
      style={{ background: "#0a0a0c" }}
    />
  );
}
