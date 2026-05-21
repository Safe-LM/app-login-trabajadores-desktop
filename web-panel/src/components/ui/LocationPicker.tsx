"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Locate, LoaderCircle, Target } from "lucide-react";

const PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="26" height="34">
    <path d="M16 1 C8.27 1 2 7.27 2 15 c0 9.5 14 23 14 23 s14-13.5 14-23 C30 7.27 23.73 1 16 1 z"
          fill="#2563eb" stroke="#0f0f10" stroke-width="1.5"/>
    <circle cx="16" cy="14" r="4.5" fill="#0f0f10"/>
  </svg>
`;

const pinIcon = () => L.divIcon({
  className: "safelink-pin",
  html: PIN_SVG,
  iconSize:   [26, 34],
  iconAnchor: [13, 34],
});

type GeoState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; accuracyM: number }
  | { phase: "error"; message: string };

/**
 * Mini mapa con toolbar de acciones (Mi ubicacion, Centrar) + click-to-place + drag.
 *
 * Implementacion en Leaflet vanilla (no react-leaflet) para evitar el bug
 * "Map container is already initialized" al abrir/cerrar el modal en React 18
 * Strict Mode.
 */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [geo, setGeo] = useState<GeoState>({ phase: "idle" });

  // Mount-once: crear mapa
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    interface LeafletNode extends HTMLDivElement { _leaflet_id?: number }
    const node = el as LeafletNode;
    if (node._leaflet_id) node._leaflet_id = undefined;

    const initialCenter: L.LatLngExpression =
      lat != null && lng != null ? [lat, lng] : [19.4326, -99.1332];
    const initialZoom = lat != null && lng != null ? 14 : 5;

    const map = L.map(el, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    if (lat != null && lng != null) {
      const marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onChangeRef.current(ll.lat, ll.lng);
      });
      markerRef.current = marker;
    }

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker con lat/lng externos
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat == null || lng == null) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (accuracyCircleRef.current) { accuracyCircleRef.current.remove(); accuracyCircleRef.current = null; }
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onChangeRef.current(ll.lat, ll.lng);
      });
      markerRef.current = marker;
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [lat, lng]);

  /** Pide al navegador la ubicacion del usuario y coloca el pin. */
  const usarMiUbicacion = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ phase: "error", message: "Tu navegador no soporta geolocalización." });
      return;
    }
    setGeo({ phase: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        onChangeRef.current(latitude, longitude);

        const map = mapRef.current;
        if (map) {
          if (accuracyCircleRef.current) accuracyCircleRef.current.remove();
          accuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: accuracy,
            color: "#2563eb",
            weight: 1,
            fillColor: "#2563eb",
            fillOpacity: 0.08,
            interactive: false,
          }).addTo(map);
        }
        setGeo({ phase: "success", accuracyM: accuracy });
      },
      (err) => {
        const message =
          err.code === err.PERMISSION_DENIED   ? "Permiso de ubicación denegado por el navegador." :
          err.code === err.POSITION_UNAVAILABLE ? "No se pudo determinar tu ubicación. Verifica Wi-Fi/GPS." :
          err.code === err.TIMEOUT              ? "Tiempo agotado al obtener ubicación. Intenta de nuevo." :
                                                  "No se pudo obtener tu ubicación.";
        setGeo({ phase: "error", message });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

  /** Centra el mapa en el pin actual (sin moverlo). */
  const centrarEnPin = useCallback(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng]);

  const hasPin = lat != null && lng != null;

  return (
    <div className="loc-picker">
      {/* Toolbar de acciones (afuera del mapa, sin chocar con zoom controls) */}
      <div className="loc-picker__toolbar" role="toolbar" aria-label="Acciones de ubicación">
        <button
          type="button"
          onClick={usarMiUbicacion}
          disabled={geo.phase === "loading"}
          className="btn btn-primary btn-sm loc-picker__btn-locate"
          title="Detectar la ubicación de este equipo (GPS/Wi-Fi)"
        >
          {geo.phase === "loading" ? (
            <LoaderCircle size={13} strokeWidth={2.5} className="animate-spin-slow" />
          ) : (
            <Locate size={13} strokeWidth={2.5} />
          )}
          {geo.phase === "loading" ? "Detectando…" : hasPin ? "Actualizar a mi ubicación" : "Usar mi ubicación"}
        </button>

        {hasPin && (
          <button
            type="button"
            onClick={centrarEnPin}
            className="btn btn-secondary btn-sm"
            title="Centrar el mapa en el pin"
          >
            <Target size={13} strokeWidth={2} />
            Centrar
          </button>
        )}
      </div>

      {/* Mapa */}
      <div
        ref={containerRef}
        className="loc-picker__map"
      />

      {/* Hint de uso (solo cuando no hay pin) */}
      {!hasPin && geo.phase === "idle" && (
        <p className="loc-picker__hint">
          Sin ubicación asignada · usa <strong>Mi ubicación</strong> o haz <strong>clic</strong> en el mapa para colocar un pin.
        </p>
      )}

      {/* Feedback inline */}
      {geo.phase === "error" && (
        <p className="loc-picker__feedback loc-picker__feedback--error">
          {geo.message}
        </p>
      )}
      {geo.phase === "success" && hasPin && (
        <p className="loc-picker__feedback loc-picker__feedback--info">
          Detectado con precisión ±{formatAccuracy(geo.accuracyM)}. Arrastra el pin para afinar.
        </p>
      )}
    </div>
  );
}

function formatAccuracy(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
