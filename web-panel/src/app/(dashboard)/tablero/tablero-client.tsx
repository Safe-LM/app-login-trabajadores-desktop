"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge, type StatusKind } from "@/components/ui/StatusBadge";
import {
  Camera, CameraOff, Users, Wifi, WifiOff,
  AlertTriangle, Clock, ChevronRight, ArrowDownToLine, ArrowUpFromLine,
  LayoutGrid, Rows3, Filter, RefreshCw,
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
  const [estaciones] = useState(initialEstaciones);
  const [marcaciones, setMarcaciones] = useState(initialMarcaciones);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [filter, setFilter]   = useState<FilterValue>("all");
  const [density, setDensity] = useState<Density>("comfortable");

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

  const stats = useMemo(() => {
    const online  = estaciones.filter(e => e.estado_conexion === "online").length;
    const alerta  = estaciones.filter(e => e.estado_conexion === "alerta").length;
    const offline = estaciones.filter(e => e.estado_conexion === "offline" || e.estado_conexion === "nunca").length;
    return { online, alerta, offline, total: estaciones.length };
  }, [estaciones]);

  const filtered = useMemo(() => {
    if (filter === "all")     return estaciones;
    if (filter === "online")  return estaciones.filter(e => e.estado_conexion === "online");
    if (filter === "warn")    return estaciones.filter(e => e.estado_conexion === "alerta");
    /* offline */             return estaciones.filter(e => e.estado_conexion === "offline" || e.estado_conexion === "nunca");
  }, [filter, estaciones]);

  return (
    <div className="tablero-page animate-fade-up">
      {/* Hero: titulo + chips de stats */}
      <header className="tablero-hero">
        <div className="tablero-hero__title">
          <h1 className="heading-1" style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
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
              kind={realtimeOk ? "online" : "offline"}
              label={realtimeOk ? "En vivo" : "Sin conexión"}
              strong={realtimeOk}
            />
          </div>
        </div>
      </header>

      {/* Toolbar: filtros + density */}
      <div className="tablero-toolbar">
        <div className="segmented" role="tablist" aria-label="Filtro por estado">
          <SegBtn active={filter === "all"}     onClick={() => setFilter("all")}    label="Todas"   count={stats.total} />
          <SegBtn active={filter === "online"}  onClick={() => setFilter("online")} label="Online"  count={stats.online}  dotColor="#22c55e" />
          <SegBtn active={filter === "warn"}    onClick={() => setFilter("warn")}   label="Alerta"  count={stats.alerta}  dotColor="#eab308" />
          <SegBtn active={filter === "offline"} onClick={() => setFilter("offline")}label="Offline" count={stats.offline} dotColor="#ef4444" />
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => router.refresh()}
          className="btn btn-ghost btn-sm"
          aria-label="Refrescar"
          title="Refrescar"
        >
          <RefreshCw size={13} strokeWidth={2} />
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
                <button onClick={() => setFilter("all")} className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}>
                  Ver todas
                </button>
              </div>
            ) : filtered.map(e => (
              <EstacionCard key={e.id} estacion={e} compact={density === "compact"} />
            ))}
          </div>

          <aside className="tablero-side">
            <div className="card" style={{ padding: 0 }}>
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <h3 className="heading-3" style={{ fontSize: 12.5, marginBottom: 2 }}>Marcaciones recientes</h3>
                  <p style={{ fontSize: 10.5, color: "var(--text-faint)" }}>Últimas 8 · tiempo real</p>
                </div>
                <span className="badge badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {marcaciones.length}
                </span>
              </div>
              {marcaciones.length === 0 ? (
                <p style={{ padding: "26px 16px", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                  Sin marcaciones aún hoy.
                </p>
              ) : (
                <div>
                  {marcaciones.map((m, i) => <MarcacionRow key={`${m.empleado_id}-${i}`} marcacion={m} />)}
                </div>
              )}
            </div>
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
          background: dotColor, marginRight: 1, flexShrink: 0,
        }} />
      )}
      {label}
      <span style={{
        fontVariantNumeric: "tabular-nums",
        fontSize: 10.5, fontWeight: 600,
        marginLeft: 2,
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
            ? "radial-gradient(ellipse at center, rgba(255,255,255,0.018) 0%, transparent 70%), #08080a"
            : "#08080a",
        }}>
          {status.kind === "online" && estacion.camara_ok !== false ? (
            <Camera size={30} strokeWidth={1.25} style={{ color: accentColor, opacity: 0.4 }} />
          ) : status.kind === "online" && estacion.camara_ok === false ? (
            <CenterIcon icon={CameraOff} label="Cámara sin señal" color="#facc15" />
          ) : status.kind === "warn" ? (
            <CenterIcon icon={AlertTriangle} label="Sin heartbeat reciente" color="#facc15" />
          ) : (
            <CenterIcon icon={WifiOff} label="Estación offline" color="var(--text-faint)" />
          )}

          {/* Overlay: IP/wifi (top-left) */}
          <div className="estacion-tile__overlay estacion-tile__overlay--tl">
            {estacion.estado_conexion === "online"
              ? <Wifi size={10} strokeWidth={2.5} />
              : <WifiOff size={10} strokeWidth={2.5} />}
            {estacion.ip_local ?? "—"}
          </div>
          {/* Overlay: version (top-right) */}
          <div className="estacion-tile__overlay estacion-tile__overlay--tr">
            v{estacion.version_app ?? "?.?"}
          </div>
          {/* Overlay: brand (bottom-right, estilo IPC/IMOU de Argus) */}
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
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </p>
    </div>
  );
}

function MarcacionRow({ marcacion }: { marcacion: MarcacionReciente }) {
  const hora = new Date(marcacion.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const isEntrada = marcacion.tipo === "entrada";
  return (
    <div className="marcacion-row">
      <div className="marcacion-row__icon" style={{
        background: isEntrada ? "rgba(34,197,94,0.10)" : "rgba(37,99,235,0.10)",
        color: isEntrada ? "#4ade80" : "var(--accent-hover)",
      }}>
        {isEntrada
          ? <ArrowDownToLine size={13} strokeWidth={2.25} />
          : <ArrowUpFromLine size={13} strokeWidth={2.25} />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {marcacion.empleado_nombre}
        </p>
        <p style={{
          fontSize: 10.5, color: "var(--text-faint)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {marcacion.sucursal_nombre ?? "Sin sucursal"} · {isEntrada ? "Entrada" : "Salida"}
        </p>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
        fontVariantNumeric: "tabular-nums",
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
