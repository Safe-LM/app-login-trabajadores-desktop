"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge, type StatusKind } from "@/components/ui/StatusBadge";
import {
  Camera, CameraOff, Users, Wifi, WifiOff,
  AlertTriangle, Clock, ChevronRight, ArrowDownToLine, ArrowUpFromLine,
  LayoutGrid, Rows3, Filter, RefreshCw, Search, Activity
} from "lucide-react";
import type { EstacionTile, MarcacionReciente } from "./page";

const ESTADO_TO_STATUS: Record<EstacionTile["estado_conexion"], { kind: StatusKind; label: string }> = {
  online:  { kind: "online",  label: "En línea" },
  alerta:  { kind: "warn",    label: "Lag" },
  offline: { kind: "error",   label: "Offline" },
  nunca:   { kind: "neutral", label: "Sin enlazar" },
};

type FilterValue = "all" | "online" | "warn" | "offline";
type Density = "comfortable" | "compact";

export function TableroClient({
  estaciones: initialEstaciones,
  marcaciones: initialMarcaciones,
}: {
  estaciones: EstacionTile[];
  marcaciones: MarcacionReciente[];
}) {
  const router = useRouter();
  const [estaciones, setEstaciones] = useState(initialEstaciones);
  const [marcaciones, setMarcaciones] = useState(initialMarcaciones);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtros y búsqueda
  const [filter, setFilter]   = useState<FilterValue>("all");
  const [search, setSearch]   = useState("");
  const [density, setDensity] = useState<Density>("comfortable");

  // Mantener estados actualizados cuando cambian las props por router.refresh()
  useEffect(() => { setEstaciones(initialEstaciones); }, [initialEstaciones]);
  useEffect(() => { setMarcaciones(initialMarcaciones); }, [initialMarcaciones]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel("tablero-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "dispositivos" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 600);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "registros_asistencia" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe(s => setRealtimeOk(s === "SUBSCRIBED"));

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (err) {
      console.error("Error al refrescar el tablero:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const online  = estaciones.filter(e => e.estado_conexion === "online").length;
    const alerta  = estaciones.filter(e => e.estado_conexion === "alerta").length;
    const offline = estaciones.filter(e => e.estado_conexion === "offline" || e.estado_conexion === "nunca").length;
    return { online, alerta, offline, total: estaciones.length };
  }, [estaciones]);

  const filtered = useMemo(() => {
    let arr = estaciones;
    if (filter === "online")  arr = arr.filter(e => e.estado_conexion === "online");
    else if (filter === "warn")    arr = arr.filter(e => e.estado_conexion === "alerta");
    else if (filter === "offline") arr = arr.filter(e => e.estado_conexion === "offline" || e.estado_conexion === "nunca");

    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(e => 
        e.nombre.toLowerCase().includes(q) || 
        (e.sucursal_nombre && e.sucursal_nombre.toLowerCase().includes(q))
      );
    }
    return arr;
  }, [filter, search, estaciones]);

  return (
    <div className="tablero-page animate-fade-up">
      {/* Hero: título */}
      <header className="tablero-hero" style={{ marginBottom: 20 }}>
        <div className="tablero-hero__title">
          <h1 className="heading-1" style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <span>Tablero</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", marginRight: 6 }}>·</span>
              {stats.total} {stats.total === 1 ? "estación" : "estaciones"}
            </span>
          </h1>
          <p className="text-muted-sm">Monitoreo en tiempo real de todas las estaciones de registro</p>
        </div>

        <div className="tablero-hero__metrics">
          <MetricChip color="#22c55e" label="Online"  value={stats.online}  />
          <MetricChip color="#eab308" label="Alerta"  value={stats.alerta}  />
          <MetricChip color="#ef4444" label="Offline" value={stats.offline} />
          <div className="tablero-hero__live">
            <StatusBadge
              kind={realtimeOk ? "live" : "offline"}
              label={realtimeOk ? "En vivo" : "Sin conexión"}
              strong={realtimeOk}
            />
          </div>
        </div>
      </header>

      {/* Rejilla de métricas ejecutivas de red */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Uptime de Red</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0}%
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(34,197,94,0.08)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wifi size={16} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Salud Promedio</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {estaciones.length > 0 ? Math.round(estaciones.reduce((acc, curr) => acc + curr.health_score, 0) / estaciones.length) : 0}%
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(59,130,246,0.08)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={16} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Estaciones Activas</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {stats.online} / {stats.total}
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(139,92,246,0.08)", color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={16} />
          </div>
        </div>
      </div>

      {/* Toolbar: filtros + density + buscador */}
      <div className="tablero-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <div className="segmented" role="tablist" aria-label="Filtro por estado">
          <SegBtn active={filter === "all"}     onClick={() => setFilter("all")}    label="Todas"   count={stats.total} />
          <SegBtn active={filter === "online"}  onClick={() => setFilter("online")} label="Online"  count={stats.online}  dotColor="#22c55e" />
          <SegBtn active={filter === "warn"}    onClick={() => setFilter("warn")}   label="Alerta"  count={stats.alerta}  dotColor="#eab308" />
          <SegBtn active={filter === "offline"} onClick={() => setFilter("offline")}label="Offline" count={stats.offline} dotColor="#ef4444" />
        </div>

        {/* Buscador de estaciones */}
        <div style={{ position: "relative", width: 220 }} className="tablero-toolbar-search">
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="text"
            placeholder="Buscar estación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 10px 7px 30px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12, color: "var(--text-primary)",
              outline: "none", transition: "all 0.15s ease"
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer",
                fontSize: 11, padding: 2
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-ghost btn-sm"
            aria-label="Refrescar"
            title="Refrescar"
            style={{ padding: 8, opacity: isRefreshing ? 0.6 : 1 }}
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin-custom" : ""} />
          </button>

          <div className="segmented" role="radiogroup" aria-label="Densidad">
            <button
              type="button"
              className={"segmented__btn" + (density === "comfortable" ? " is-active" : "")}
              onClick={() => setDensity("comfortable")}
              aria-pressed={density === "comfortable"}
              title="Vista cómoda"
            >
              <LayoutGrid size={13} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={"segmented__btn" + (density === "compact" ? " is-active" : "")}
              onClick={() => setDensity("compact")}
              aria-pressed={density === "compact"}
              title="Vista compacta"
            >
              <Rows3 size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {estaciones.length === 0 ? (
        <EmptyTablero />
      ) : (
        <div className="tablero-body">
          <div
            className={"tablero-grid stagger-fade-up" + (density === "compact" ? " tablero-grid--compact" : "")}
            data-empty={filtered.length === 0 ? "true" : undefined}
          >
            {filtered.length === 0 ? (
              <div className="tablero-grid__empty">
                <Filter size={22} strokeWidth={1.5} style={{ color: "var(--text-faint)", marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                  No hay estaciones con ese filtro
                </p>
                <button onClick={() => { setFilter("all"); setSearch(""); }} className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}>
                  Ver todas
                </button>
              </div>
            ) : filtered.map(e => (
              <EstacionCard key={e.id} estacion={e} compact={density === "compact"} />
            ))}
          </div>

          <aside className="tablero-side">
            <div className="card" style={{ padding: 0, border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{
                padding: "14px 18px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <h3 className="heading-3" style={{ fontSize: 13, marginBottom: 2 }}>Marcaciones recientes</h3>
                  <p style={{ fontSize: 10.5, color: "var(--text-faint)", margin: 0 }}>Últimas 8 · tiempo real</p>
                </div>
                <span className="badge badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {marcaciones.length}
                </span>
              </div>
              {marcaciones.length === 0 ? (
                <p style={{ padding: "32px 18px", fontSize: 12, color: "var(--text-faint)", textAlign: "center", margin: 0 }}>
                  Sin marcaciones aún hoy.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {marcaciones.map((m, i) => <MarcacionRow key={`${m.empleado_id}-${i}`} marcacion={m} />)}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Inyección de Keyframes de escaneo e intermitencia */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 0.8s linear infinite;
        }
        @keyframes blink-rec {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .blinking-rec-dot {
          animation: blink-rec 1.2s infinite;
        }
        @keyframes scan-laser {
          0% { top: 8px; }
          50% { top: calc(100% - 10px); }
          100% { top: 8px; }
        }
        .scanning-laser-line {
          animation: scan-laser 4s ease-in-out infinite;
        }
        .marcacion-item-row {
          transition: background-color 0.15s ease;
        }
        .marcacion-item-row:hover {
          background-color: rgba(255, 255, 255, 0.015) !important;
        }
      `}} />
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

function SegBtn({ active, onClick, label, count, dotColor }: {
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
          background: dotColor, marginRight: 4, flexShrink: 0,
        }} />
      )}
      {label}
      <span style={{
        fontVariantNumeric: "tabular-nums",
        fontSize: 10.5, fontWeight: 600,
        marginLeft: 4,
        color: active ? "var(--text-primary)" : "var(--text-faint)",
      }}>
        {count}
      </span>
    </button>
  );
}

function EstacionCard({ estacion, compact }: { estacion: EstacionTile; compact: boolean }) {
  const status = ESTADO_TO_STATUS[estacion.estado_conexion];
  const accentColor =
    status.kind === "online"  ? "#22c55e" :
    status.kind === "warn"    ? "#eab308" :
    status.kind === "error"   ? "#ef4444" :
    "#52525b";

  return (
    <div
      className={"card estacion-tile" + (compact ? " estacion-tile--compact" : "")}
      data-status={status.kind}
      style={{ border: `1px solid var(--border)`, transition: "transform 0.15s ease, border-color 0.15s ease" }}
    >
      {/* Border accent superior por estado */}
      <div className="estacion-tile__accent" style={{ background: accentColor }} />

      {/* Header */}
      <div className="estacion-tile__header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="estacion-tile__name">{estacion.nombre}</p>
          <p className="estacion-tile__sucursal">{estacion.sucursal_nombre ?? "Sin sucursal"}</p>
        </div>
        <StatusBadge kind={status.kind} label={status.label} strong={status.kind === "online"} />
      </div>

      {/* Preview area */}
      {!compact && (
        <div className="estacion-tile__preview" style={{
          background: status.kind === "online"
            ? "radial-gradient(ellipse at center, rgba(255,255,255,0.015) 0%, transparent 70%), #08080a"
            : "#08080a",
          position: "relative"
        }}>
          {status.kind === "online" && (
            <>
              {/* Esquinas del Viewfinder */}
              <div className="camera-viewfinder corners-tl" style={{ position: "absolute", top: 8, left: 8, width: 8, height: 8, borderTop: "2px solid #10b981", borderLeft: "2px solid #10b981", opacity: 0.6 }} />
              <div className="camera-viewfinder corners-tr" style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderTop: "2px solid #10b981", borderRight: "2px solid #10b981", opacity: 0.6 }} />
              <div className="camera-viewfinder corners-bl" style={{ position: "absolute", bottom: 8, left: 8, width: 8, height: 8, borderBottom: "2px solid #10b981", borderLeft: "2px solid #10b981", opacity: 0.6 }} />
              <div className="camera-viewfinder corners-br" style={{ position: "absolute", bottom: 8, right: 8, width: 8, height: 8, borderBottom: "2px solid #10b981", borderRight: "2px solid #10b981", opacity: 0.6 }} />

              {/* Indicador REC / LIVE — esquina superior derecha */}
              <div style={{
                position: "absolute", top: 12, right: 16, display: "flex", alignItems: "center", gap: 5,
                background: "rgba(0,0,0,0.65)", padding: "2px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", zIndex: 3
              }}>
                <span className="blinking-rec-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ fontSize: 8, color: "#fff", fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
              </div>

              {/* Láser de barrido vertical */}
              <div className="scanning-laser-line" style={{
                position: "absolute", left: 8, right: 8, height: 1.5,
                background: "linear-gradient(90deg, transparent, #10b981, transparent)",
                boxShadow: "0 0 6px #10b981", zIndex: 1
              }} />
            </>
          )}

          {status.kind === "online" && estacion.camara_ok !== false ? (
            <Camera size={30} strokeWidth={1.25} style={{ color: accentColor, opacity: 0.4 }} />
          ) : status.kind === "online" && estacion.camara_ok === false ? (
            <CenterIcon icon={CameraOff} label="Cámara sin señal" color="#facc15" />
          ) : status.kind === "warn" ? (
            <CenterIcon icon={AlertTriangle} label="Sin heartbeat reciente" color="#facc15" />
          ) : (
            <CenterIcon icon={WifiOff} label="Estación offline" color="var(--text-faint)" />
          )}

          {/* Overlay: IP/wifi (top-left) — sola, sin encimarse con LIVE */}
          <div className="estacion-tile__overlay estacion-tile__overlay--tl">
            {estacion.estado_conexion === "online"
              ? <Wifi size={10} strokeWidth={2.5} />
              : <WifiOff size={10} strokeWidth={2.5} />}
            {estacion.ip_local ?? "—"}
          </div>
          {/* Overlay: version (bottom-left, junto al brand) */}
          <div className="estacion-tile__overlay estacion-tile__overlay--tr" style={{ top: "auto", bottom: 8, right: "auto", left: 10, fontSize: 9 }}>
            v{estacion.version_app ?? "?.?"}
          </div>
          {/* Overlay: brand */}
          <div className="estacion-tile__brand">SAFE LINK</div>
        </div>
      )}

      {/* Metrics footer */}
      <div className="estacion-tile__metrics">
        <Metric
          label="Equipo"
          value={
            <>
              <Users size={11} strokeWidth={2} />
              {estacion.empleados_count}
            </>
          }
        />
        <Metric
          label="Salud"
          value={`${estacion.health_score}%`}
          color={estacion.health_score >= 70 ? "#4ade80" : estacion.health_score >= 40 ? "#facc15" : "#f87171"}
        />
        <Metric
          label="Últ. sync"
          value={
            <>
              <Clock size={11} strokeWidth={2} style={{ color: "var(--text-faint)" }} />
              {formatHeartbeat(estacion.segundos_desde_heartbeat)}
            </>
          }
        />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div>
      <p className="estacion-tile__metric-label">{label}</p>
      <p className="estacion-tile__metric-value" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function CenterIcon({ icon: Icon, label, color }: { icon: typeof Camera; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center", color }}>
      <Icon size={22} strokeWidth={1.5} style={{ margin: "0 auto 4px" }} />
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

function MarcacionRow({ marcacion }: { marcacion: MarcacionReciente }) {
  const hora = new Date(marcacion.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const isEntrada = marcacion.tipo === "entrada";
  return (
    <div className="marcacion-row marcacion-item-row" style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <div className="marcacion-row__icon" style={{
        background: isEntrada ? "rgba(34,197,94,0.10)" : "rgba(37,99,235,0.10)",
        color: isEntrada ? "#4ade80" : "var(--accent-hover)",
        width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        {isEntrada
          ? <ArrowDownToLine size={13} strokeWidth={2.25} />
          : <ArrowUpFromLine size={13} strokeWidth={2.25} />}
      </div>
      <div style={{ minWidth: 0, flex: 1, marginLeft: 12 }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0
        }}>
          {marcacion.empleado_nombre}
        </p>
        <p style={{
          fontSize: 10.5, color: "var(--text-faint)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0 0"
        }}>
          {marcacion.sucursal_nombre ?? "Sin sucursal"} · {isEntrada ? "Entrada" : "Salida"}
        </p>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
        fontVariantNumeric: "tabular-nums", marginLeft: 8
      }}>
        {hora}
      </span>
    </div>
  );
}

function EmptyTablero() {
  return (
    <div className="empty-state" style={{ marginTop: 24 }}>
      <div className="empty-state-icon">
        <Camera size={22} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        Sin estaciones registradas
      </h3>
      <p className="text-muted-sm" style={{ maxWidth: 340 }}>
        Cuando enlaces estaciones de registro, aparecerán aquí con su estado en tiempo real.
      </p>
      <a href="/dispositivos" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
        Ir a Estaciones
        <ChevronRight size={14} strokeWidth={2.5} />
      </a>
    </div>
  );
}

function formatHeartbeat(secs: number | null): string {
  if (secs == null) return "—";
  if (secs < 60)    return `${Math.floor(secs)}s`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
