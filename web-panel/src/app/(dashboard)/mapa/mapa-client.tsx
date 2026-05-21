"use client";
import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Map as MapIcon, MapPin, Building2, AlertCircle } from "lucide-react";
import type { SucursalMapa } from "./page";

// Leaflet usa window — debe cargarse client-side
const MapView = dynamic(() => import("./MapView").then(m => m.MapView), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--bg-card)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-faint)", fontSize: 12,
    }}>
      Cargando mapa…
    </div>
  ),
});

export function MapaClient({ sucursales }: { sucursales: SucursalMapa[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const conUbicacion   = useMemo(() => sucursales.filter(s => s.lat != null && s.lng != null), [sucursales]);
  const sinUbicacion   = useMemo(() => sucursales.filter(s => s.lat == null || s.lng == null), [sucursales]);
  const onlineCount    = sucursales.reduce((acc, s) => acc + s.estaciones_online, 0);
  const totalEstaciones = sucursales.reduce((acc, s) => acc + s.estaciones_total, 0);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }} className="animate-fade-up">
      <PageHeader
        title="Mapa"
        count={`${sucursales.length} ${sucursales.length === 1 ? "sucursal" : "sucursales"}`}
        subtitle="Vista geográfica de tus sucursales y estaciones"
        icon={<MapIcon size={18} strokeWidth={1.75} />}
        stats={[
          { label: "Estaciones online", value: `${onlineCount}/${totalEstaciones}` },
        ]}
      />

      {sucursales.length === 0 ? (
        <EmptyMapa />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, marginTop: 18 }}>
          {/* Mapa */}
          <div className="card" style={{
            padding: 0, overflow: "hidden",
            height: "calc(100dvh - 220px)", minHeight: 500,
            position: "relative",
          }}>
            {conUbicacion.length > 0 ? (
              <MapView
                sucursales={conUbicacion}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <div style={{
                height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
                color: "var(--text-faint)", textAlign: "center", padding: 24,
              }}>
                <MapPin size={28} strokeWidth={1.5} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                    Ninguna sucursal tiene ubicación
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4, maxWidth: 280 }}>
                    Edita una sucursal y marca su posición en el mapa desde la pestaña <strong>Ubicación</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar derecho */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  Sucursales en el mapa
                </h3>
                <p style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>
                  {conUbicacion.length} con ubicación
                </p>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {conUbicacion.length === 0 ? (
                  <p style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" }}>
                    Todavía nada aquí.
                  </p>
                ) : conUbicacion.map(s => (
                  <SucursalRow
                    key={s.id}
                    sucursal={s}
                    selected={selected === s.id}
                    onClick={() => setSelected(s.id)}
                  />
                ))}
              </div>
            </div>

            {sinUbicacion.length > 0 && (
              <div className="card" style={{ padding: 0, border: "1px solid rgba(234,179,8,0.18)" }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <AlertCircle size={14} strokeWidth={2} style={{ color: "#facc15" }} />
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                    Sin ubicación ({sinUbicacion.length})
                  </h3>
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {sinUbicacion.map(s => (
                    <div key={s.id} style={{
                      padding: "10px 16px", borderBottom: "1px solid var(--border)",
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

function SucursalRow({ sucursal: s, selected, onClick }: { sucursal: SucursalMapa; selected: boolean; onClick: () => void }) {
  const pctOnline = s.estaciones_total > 0 ? Math.round((s.estaciones_online / s.estaciones_total) * 100) : 0;
  const status =
    s.estaciones_total === 0 ? { kind: "neutral" as const, label: "Sin estaciones" } :
    pctOnline >= 80          ? { kind: "online"  as const, label: `${pctOnline}% online` } :
    pctOnline >= 40          ? { kind: "warn"    as const, label: `${pctOnline}% online` } :
                                { kind: "error"   as const, label: `${pctOnline}% online` };

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", border: "none",
        background: selected ? "rgba(37,99,235,0.08)" : "transparent",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", flexDirection: "column", gap: 5,
        cursor: "pointer", color: "inherit", fontFamily: "inherit",
        transition: "background 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {s.nombre}
        </span>
        <StatusBadge kind={status.kind} label={status.label} />
      </div>
      <p style={{
        fontSize: 10.5, color: "var(--text-faint)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {s.direccion ?? "Sin dirección"}
      </p>
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
        Ir a Sucursales
      </a>
    </div>
  );
}
