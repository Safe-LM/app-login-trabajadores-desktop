"use client";
import React, { useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Map as MapIcon, MapPin, Building2, AlertCircle, Maximize2, Filter, Activity,
} from "lucide-react";
import type { SucursalMapa } from "./page";
import type { MapViewHandle } from "./MapView";

const MapView = dynamic(() => import("./MapView").then(m => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="map-loading__pulse" />
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 16 }}>
        Cargando mapa…
      </p>
    </div>
  ),
});

type FilterValue = "all" | "online" | "warn" | "offline";

function classifyStatus(s: SucursalMapa): "online" | "warn" | "offline" | "neutral" {
  if (s.estaciones_total === 0) return "neutral";
  const pct = (s.estaciones_online / s.estaciones_total) * 100;
  if (pct >= 80) return "online";
  if (pct >= 40) return "warn";
  return "offline";
}

export function MapaClient({ sucursales }: { sucursales: SucursalMapa[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterValue>("all");
  const mapHandleRef = useRef<MapViewHandle | null>(null);

  const conUbicacion = useMemo(() => sucursales.filter(s => s.lat != null && s.lng != null), [sucursales]);
  const sinUbicacion = useMemo(() => sucursales.filter(s => s.lat == null || s.lng == null), [sucursales]);

  const stats = useMemo(() => {
    const online  = conUbicacion.filter(s => classifyStatus(s) === "online").length;
    const warn    = conUbicacion.filter(s => classifyStatus(s) === "warn").length;
    const offline = conUbicacion.filter(s => classifyStatus(s) === "offline" || classifyStatus(s) === "neutral").length;
    return { online, warn, offline, total: conUbicacion.length };
  }, [conUbicacion]);

  const filtered = useMemo(() => {
    if (filter === "all") return conUbicacion;
    return conUbicacion.filter(s => {
      const status = classifyStatus(s);
      if (filter === "offline") return status === "offline" || status === "neutral";
      return status === filter;
    });
  }, [filter, conUbicacion]);

  const onlineCount     = sucursales.reduce((acc, s) => acc + s.estaciones_online, 0);
  const totalEstaciones = sucursales.reduce((acc, s) => acc + s.estaciones_total, 0);

  return (
    <div className="mapa-page animate-fade-up">
      {/* Hero */}
      <header className="tablero-hero" style={{ marginBottom: 16 }}>
        <div className="tablero-hero__title">
          <h1 className="heading-1" style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span>Mapa</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", marginRight: 6 }}>·</span>
              {sucursales.length} {sucursales.length === 1 ? "sucursal" : "sucursales"}
            </span>
          </h1>
          <p className="text-muted-sm">Vista geográfica de tus sucursales y estaciones en tiempo real</p>
        </div>

        <div className="tablero-hero__metrics">
          <MetricChip color="#22c55e" label="Online"  value={stats.online}  />
          <MetricChip color="#eab308" label="Alerta"  value={stats.warn}    />
          <MetricChip color="#ef4444" label="Offline" value={stats.offline} />
          <div className="tablero-hero__live">
            <StatusBadge kind="live" label={`${onlineCount}/${totalEstaciones} estaciones`} strong />
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="tablero-toolbar" style={{ marginBottom: 14 }}>
        <div className="segmented" role="tablist" aria-label="Filtro por estado">
          <FilterBtn active={filter === "all"}     onClick={() => setFilter("all")}    label="Todas"   count={stats.total} />
          <FilterBtn active={filter === "online"}  onClick={() => setFilter("online")} label="Online"  count={stats.online}  dotColor="#22c55e" />
          <FilterBtn active={filter === "warn"}    onClick={() => setFilter("warn")}   label="Alerta"  count={stats.warn}    dotColor="#eab308" />
          <FilterBtn active={filter === "offline"} onClick={() => setFilter("offline")}label="Offline" count={stats.offline} dotColor="#ef4444" />
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => mapHandleRef.current?.fitToAll()}
          className="btn btn-secondary btn-sm"
          title="Centrar mapa en todas las sucursales"
        >
          <Maximize2 size={13} strokeWidth={2} />
          Ver todas
        </button>
      </div>

      {sucursales.length === 0 ? (
        <EmptyMapa />
      ) : (
        <div className="mapa-body">
          {/* Mapa con overlays */}
          <div className="mapa-frame">
            {conUbicacion.length > 0 ? (
              <>
                <MapView
                  sucursales={filtered}
                  selected={selected}
                  onSelect={setSelected}
                  onReady={h => { mapHandleRef.current = h; }}
                />

                {/* Overlay top-right: counter */}
                <div className="mapa-overlay mapa-overlay--top-right">
                  <span className="mapa-overlay__dot" style={{ background: "var(--teal-hover)" }} />
                  <span className="mapa-overlay__label">{filtered.length} en mapa</span>
                </div>

                {/* Overlay bottom-left: leyenda */}
                <div className="mapa-overlay mapa-overlay--bottom-left mapa-legend" role="note" aria-label="Leyenda">
                  <span className="mapa-legend__title">
                    <Filter size={10} strokeWidth={2} /> Leyenda
                  </span>
                  <LegendItem color="#22c55e" label="Online ≥80%" />
                  <LegendItem color="#eab308" label="Alerta 40–80%" />
                  <LegendItem color="#ef4444" label="Offline <40%" />
                  <LegendItem color="#52525b" label="Sin estaciones" />
                </div>
              </>
            ) : (
              <div className="mapa-frame__empty">
                <MapPin size={28} strokeWidth={1.5} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Ninguna sucursal tiene ubicación
                </p>
                <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4, maxWidth: 280 }}>
                  Edita una sucursal y marca su posición en el mapa desde la pestaña{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>Ubicación</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Aside */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Lista de sucursales con ubicacion */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{
                padding: "12px 14px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <h3 className="heading-3" style={{ fontSize: 12.5, marginBottom: 2 }}>
                    Sucursales en el mapa
                  </h3>
                  <p style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                    {filtered.length} mostradas · {conUbicacion.length} con ubicación
                  </p>
                </div>
                <Activity size={12} strokeWidth={2} style={{ color: "var(--teal-hover)" }} />
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <p style={{ padding: "26px 16px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>
                    Sin sucursales con este filtro.
                  </p>
                ) : filtered.map(s => (
                  <SucursalRow
                    key={s.id}
                    sucursal={s}
                    selected={selected === s.id}
                    onClick={() => setSelected(s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Sin ubicacion */}
            {sinUbicacion.length > 0 && (
              <div className="card" style={{ padding: 0, borderColor: "rgba(234,179,8,0.18)" }}>
                <div style={{
                  padding: "12px 14px", borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <AlertCircle size={13} strokeWidth={2} style={{ color: "#facc15" }} />
                  <h3 className="heading-3" style={{ fontSize: 12.5 }}>
                    Sin ubicación · {sinUbicacion.length}
                  </h3>
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {sinUbicacion.map(s => (
                    <div key={s.id} style={{
                      padding: "10px 14px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.nombre}
                        </p>
                        <p style={{
                          fontSize: 10, color: "var(--text-faint)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.direccion ?? "Sin dirección"}
                        </p>
                      </div>
                      <a
                        href="/sucursales"
                        style={{
                          fontSize: 10, fontWeight: 600, color: "var(--accent-hover)",
                          textDecoration: "none", whiteSpace: "nowrap",
                        }}
                      >
                        Asignar →
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MetricChip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="metric-chip" style={{ "--mc": color } as React.CSSProperties}>
      <span className="metric-chip__dot" />
      <span className="metric-chip__label">{label}</span>
      <span className="metric-chip__value">{value}</span>
    </div>
  );
}

function FilterBtn({ active, onClick, label, count, dotColor }: {
  active: boolean; onClick: () => void; label: string; count: number; dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"segmented__btn" + (active ? " is-active" : "")}
      aria-pressed={active}
      style={{ paddingRight: 10 }}
    >
      {dotColor && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: dotColor, flexShrink: 0,
        }} />
      )}
      {label}
      <span style={{
        fontFamily: "var(--font-data)", fontSize: 10.5, fontWeight: 600, marginLeft: 2,
        color: active ? "var(--text-primary)" : "var(--text-faint)",
      }}>
        {count}
      </span>
    </button>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="mapa-legend__item">
      <span className="mapa-legend__dot" style={{ background: color }} />
      {label}
    </span>
  );
}

function SucursalRow({ sucursal: s, selected, onClick }: { sucursal: SucursalMapa; selected: boolean; onClick: () => void }) {
  const status = classifyStatus(s);
  const meta = {
    online:  { kind: "online"  as const, label: "Online"  },
    warn:    { kind: "warn"    as const, label: "Alerta"  },
    offline: { kind: "error"   as const, label: "Offline" },
    neutral: { kind: "neutral" as const, label: "—"       },
  }[status];

  const pctOnline = s.estaciones_total > 0
    ? Math.round((s.estaciones_online / s.estaciones_total) * 100)
    : null;

  return (
    <button
      onClick={onClick}
      className={"sucursal-row" + (selected ? " sucursal-row--selected" : "")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {s.nombre}
        </span>
        <StatusBadge kind={meta.kind} label={meta.label} />
      </div>
      <p style={{
        fontSize: 10.5, color: "var(--text-faint)", marginTop: 3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {s.direccion ?? "Sin dirección"}
      </p>
      <div style={{
        marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
        fontFamily: "var(--font-data)", fontSize: 11,
      }}>
        <span style={{ color: "var(--text-secondary)" }}>
          {s.estaciones_online}<span style={{ color: "var(--text-faint)" }}>/{s.estaciones_total}</span>{" "}
          <span style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: "0.04em", marginLeft: 2 }}>
            estaciones
          </span>
        </span>
        {pctOnline != null && (
          <span style={{
            color: pctOnline >= 80 ? "#4ade80" : pctOnline >= 40 ? "#facc15" : "#f87171",
            fontWeight: 600,
          }}>
            {pctOnline}%
          </span>
        )}
      </div>
    </button>
  );
}

function EmptyMapa() {
  return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <div className="empty-state-icon">
        <Building2 size={22} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        Sin sucursales para mapear
      </h3>
      <p className="text-muted-sm" style={{ maxWidth: 340 }}>
        Cuando registres sucursales y marques su ubicación, las verás aquí con su estado en tiempo real.
      </p>
      <a href="/sucursales" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
        <MapIcon size={14} strokeWidth={2} />
        Ir a Sucursales
      </a>
    </div>
  );
}
