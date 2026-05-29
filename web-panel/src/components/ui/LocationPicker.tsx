"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Locate, LoaderCircle, Target, Search, MapPin } from "lucide-react";

// Geocoding con Nominatim (OpenStreetMap) — gratis, sin API key. Límite ~1
// req/s, así que solo geocodificamos en acciones explícitas (buscar / soltar
// pin), nunca por cada tecla.
const NOMINATIM = "https://nominatim.openstreetmap.org";

import { geocodeAddress } from "@/lib/geocoding";


async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&accept-language=es&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.display_name as string) ?? null;
}

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
  onAddressResolved,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Se llama con la dirección resuelta al geocodificar/buscar/soltar pin. */
  onAddressResolved?: (address: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAddressRef = useRef(onAddressResolved);
  onAddressRef.current = onAddressResolved;

  const [geo, setGeo] = useState<GeoState>({ phase: "idle" });
  const [query, setQuery] = useState("");          // búsqueda por dirección
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [latInput, setLatInput] = useState(lat != null ? lat.toString() : "");    // entrada manual de coords
  const [lngInput, setLngInput] = useState(lng != null ? lng.toString() : "");

  // Reverse-geocode cuando se coloca un pin (click/drag/GPS) para autollenar
  // la dirección. Best-effort: si falla, no rompe nada.
  const resolveAddress = useCallback((la: number, ln: number) => {
    if (!onAddressRef.current) return;
    reverseGeocode(la, ln).then((addr) => {
      if (addr && onAddressRef.current) onAddressRef.current(addr);
    }).catch(() => {});
  }, []);

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
      resolveAddress(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    if (lat != null && lng != null) {
      const marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onChangeRef.current(ll.lat, ll.lng);
        resolveAddress(ll.lat, ll.lng);
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
        resolveAddress(ll.lat, ll.lng);
      });
      markerRef.current = marker;
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [lat, lng, resolveAddress]);

  // Sync inputs con lat/lng props (cuando cambian externamente, por ejemplo, click/drag/GPS)
  useEffect(() => {
    if (lat != null) {
      const parsedLat = parseFloat(latInput.replace(",", "."));
      if (parsedLat !== lat) {
        setLatInput(lat.toString());
      }
    } else {
      if (latInput !== "") setLatInput("");
    }

    if (lng != null) {
      const parsedLng = parseFloat(lngInput.replace(",", "."));
      if (parsedLng !== lng) {
        setLngInput(lng.toString());
      }
    } else {
      if (lngInput !== "") setLngInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        resolveAddress(latitude, longitude);
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
  }, [resolveAddress]);

  /** Busca una dirección escrita y coloca el pin (geocoding). */
  const buscarDireccion = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) { setSearchMsg("Escribe una dirección más completa."); return; }
    setSearching(true);
    setSearchMsg(null);
    try {
      const hit = await geocodeAddress(q);
      if (!hit) { setSearchMsg("No se encontró esa dirección. Prueba con más detalle (ciudad, estado)."); return; }
      onChangeRef.current(hit.lat, hit.lng);
      if (onAddressRef.current) onAddressRef.current(hit.label);
      const map = mapRef.current;
      if (map) map.flyTo([hit.lat, hit.lng], 16, { duration: 0.6 });
      setSearchMsg(null);
    } catch {
      setSearchMsg("Error al buscar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  /** Aplica coordenadas escritas manualmente. */
  const aplicarCoords = useCallback(() => {
    const la = parseFloat(latInput.replace(",", "."));
    const ln = parseFloat(lngInput.replace(",", "."));
    if (!Number.isFinite(la) || la < -90 || la > 90) { setSearchMsg("Latitud inválida (-90 a 90)."); return; }
    if (!Number.isFinite(ln) || ln < -180 || ln > 180) { setSearchMsg("Longitud inválida (-180 a 180)."); return; }
    setSearchMsg(null);
    onChangeRef.current(la, ln);
    resolveAddress(la, ln);
    const map = mapRef.current;
    if (map) map.flyTo([la, ln], 16, { duration: 0.6 });
  }, [latInput, lngInput, resolveAddress]);

  /** Centra el mapa en el pin actual (sin moverlo). */
  const centrarEnPin = useCallback(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng]);

  const hasPin = lat != null && lng != null;

  return (
    <div className="loc-picker">
      {/* Barra de búsqueda por dirección (geocoding) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} strokeWidth={2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDireccion(); } }}
            placeholder="Buscar dirección (calle, número, ciudad, estado)…"
            style={{
              width: "100%", padding: "9px 12px 9px 32px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={buscarDireccion}
          disabled={searching}
          className="btn btn-primary btn-sm"
          title="Buscar la dirección en el mapa"
        >
          {searching ? <LoaderCircle size={13} strokeWidth={2.5} className="animate-spin-slow" /> : <Search size={13} strokeWidth={2.5} />}
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {/* Entrada manual de coordenadas */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <div style={{ display: "flex", flex: 1, gap: 6 }}>
          <input
            type="text"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            placeholder="Latitud (ej: 19.4326)"
            style={{
              flex: 1, padding: "9px 12px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none",
            }}
          />
          <input
            type="text"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            placeholder="Longitud (ej: -99.1332)"
            style={{
              flex: 1, padding: "9px 12px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={aplicarCoords}
          className="btn btn-secondary btn-sm"
          style={{ height: 38 }}
          title="Aplicar coordenadas manuales"
        >
          Aplicar
        </button>
      </div>

      {searchMsg && (
        <p className="loc-picker__feedback loc-picker__feedback--error" style={{ marginBottom: 8 }}>
          {searchMsg}
        </p>
      )}

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
