"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Dispositivo = {
  id: string; nombre: string; activo: boolean;
  ip_local: string | null; hostname: string | null;
  heartbeat_at: string | null; version_app: string | null;
  api_key: string; config: Record<string, unknown>;
  sucursal_id: string | null; sucursal_nombre: string | null;
  estado_conexion: "online" | "alerta" | "offline" | "nunca";
  segundos_desde_heartbeat: number | null;
  creado_por: string | null;
  hwid: string | null;
  // Health fields
  empleados_count: number;
  health_score: number;
  ultimo_sync_at: string | null;
  encodings_version: number;
  camara_ok: boolean | null;
};
type Sucursal = { id: string; nombre: string };

const ESTADO = {
  online:  { color: "#22c55e", glow: "rgba(34,197,94,0.35)",  bg: "rgba(34,197,94,0.07)",  border: "rgba(34,197,94,0.18)",  label: "En línea",        dot: true  },
  alerta:  { color: "#f59e0b", glow: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.18)", label: "Sin señal",       dot: false },
  offline: { color: "#ef4444", glow: "rgba(239,68,68,0.35)",  bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.18)",  label: "Offline",         dot: false },
  nunca:   { color: "#52525b", glow: "transparent",           bg: "rgba(39,39,42,0.5)",    border: "rgba(63,63,70,0.4)",   label: "Sin activar",     dot: false },
};

function fmtLabel(secs: number | null) {
  if (secs == null) return "Nunca";
  if (secs < 60)   return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
  return `hace ${Math.floor(secs / 3600)}h`;
}

/* ── Uptime bar visual ── */
function HeartbeatBar({ secs }: { secs: number | null }) {
  const max = 120;
  const pct = secs == null ? 0 : Math.max(0, Math.min(1, 1 - secs / max));
  const color = secs == null ? "#3f3f46" : secs <= 60 ? "#22c55e" : secs <= 300 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-faint)", minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtLabel(secs)}
      </span>
    </div>
  );
}

/* ── Health Score bar ── */
function HealthBar({ score, camara, empleados, syncAt }: {
  score: number; camara: boolean | null; empleados: number; encodings: number; syncAt: string | null;
}) {
  const color = score >= 80 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const fmtSync = syncAt ? new Date(syncAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          Salud del sistema
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{score}/100</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 2 }}>
        {([
          ["Cámara",    camara === true ? "✓ OK" : camara === false ? "✗ Error" : "—", camara === true ? "#22c55e" : camara === false ? "#ef4444" : "var(--text-faint)"],
          ["Empleados", String(empleados), empleados > 0 ? "#22c55e" : "var(--text-faint)"],
          ["Sync",      fmtSync,          syncAt ? "#22c55e" : "var(--text-faint)"],
        ] as [string, string, string][]).map(([k, v, c]) => (
          <div key={k} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "4px 6px" }}>
            <p style={{ fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 1 }}>{k}</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: c }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── API Key ── */
function ApiKey({ apiKey }: { apiKey: string }) {
  const [vis, setVis]       = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = `${apiKey.slice(0, 8)}${"•".repeat(16)}`;

  function copy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <code style={{ flex: 1, fontSize: 10, color: "var(--text-faint)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {vis ? apiKey : masked}
      </code>
      <button onClick={() => setVis(!vis)} title={vis ? "Ocultar" : "Ver"} style={btnGhost}>
        {vis
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        }
      </button>
      <button onClick={copy} title="Copiar" style={{ ...btnGhost, color: copied ? "#22c55e" : undefined }}>
        {copied
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        }
      </button>
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-faint)", padding: "2px", display: "flex",
  alignItems: "center", justifyContent: "center", borderRadius: 4,
  transition: "color 150ms",
};

/* ── Pill de estado ── */
function EstadoPill({ estado }: { estado: keyof typeof ESTADO }) {
  const m = ESTADO[estado];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
      padding: "3px 8px", borderRadius: 99,
      background: m.bg, border: `1px solid ${m.border}`, color: m.color,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: m.color, flexShrink: 0,
        boxShadow: m.dot ? `0 0 6px ${m.glow}` : "none",
        animation: m.dot ? "pulse-dot 2s ease-in-out infinite" : "none",
      }} />
      {m.label}
    </span>
  );
}

/* ── Card de dispositivo ── */
function DispositivoCard({ d, onConfig, onLogs, index }: { d: Dispositivo; onConfig: (d: Dispositivo) => void; onLogs: (d: Dispositivo) => void; index: number }) {
  const m = ESTADO[d.estado_conexion];
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${hov ? m.border : "var(--border)"}`,
        borderRadius: 14,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        transition: "border-color 200ms, box-shadow 200ms, transform 200ms",
        boxShadow: hov ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${m.border}` : "0 2px 8px rgba(0,0,0,0.2)",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        animationDelay: `${index * 50}ms`,
        animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* Barra de color superior según estado */}
      <div style={{
        height: 2,
        background: d.estado_conexion === "online"
          ? `linear-gradient(90deg, transparent, ${m.color} 40%, ${m.color} 60%, transparent)`
          : d.estado_conexion === "nunca"
          ? "var(--border)"
          : `linear-gradient(90deg, transparent, ${m.color} 40%, ${m.color} 60%, transparent)`,
        opacity: d.estado_conexion === "nunca" ? 0.3 : 0.7,
      }} />

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>

        {/* Header: icono + nombre + estado */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: d.estado_conexion === "online" ? "rgba(34,197,94,0.08)" : "var(--bg-elevated)",
              border: `1px solid ${d.estado_conexion === "online" ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 200ms, border-color 200ms",
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={d.estado_conexion === "online" ? "#22c55e" : "var(--text-faint)"}
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.nombre}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.sucursal_nombre ?? "Sin sucursal"}
              </p>
            </div>
          </div>
          <EstadoPill estado={d.estado_conexion} />
        </div>

        {/* Heartbeat bar */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
              Último heartbeat
            </span>
          </div>
          <HeartbeatBar secs={d.segundos_desde_heartbeat} />
        </div>

        {/* Health score */}
        <HealthBar
          score={d.health_score ?? 0}
          camara={d.camara_ok}
          empleados={d.empleados_count ?? 0}
          encodings={d.encodings_version ?? 0}
          syncAt={d.ultimo_sync_at}
        />

        {/* Grid de metadatos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
          {([
            ["IP local",  d.ip_local   ?? "—"],
            ["Hostname",  d.hostname   ?? "—"],
            ["Versión",   d.version_app ? `v${d.version_app}` : "—"],
            ["HWID",      d.hwid ? `${d.hwid.slice(0, 10)}…` : "—"],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 2 }}>{k}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</p>
            </div>
          ))}
        </div>

        {/* API Key */}
        <div style={{
          padding: "8px 10px",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4 }}>API Key</p>
          <ApiKey apiKey={d.api_key} />
        </div>

        {/* Footer: admin + botones */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
          {d.creado_por ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%",
                background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800, color: "var(--accent)",
              }}>
                {d.creado_por[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>
                {d.creado_por}
              </span>
            </div>
          ) : <span />}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => onLogs(d)}
              title="Ver logs"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 10px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 7, fontSize: 11, fontWeight: 600,
                color: "var(--text-faint)",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Logs
            </button>
            <button
              onClick={() => onConfig(d)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px",
                background: hov ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${hov ? "var(--border-hover)" : "var(--border)"}`,
                borderRadius: 7, fontSize: 11, fontWeight: 600,
                color: hov ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Configurar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Modal base (overlay animado) ── */
function Modal({ onClose, children, maxWidth = 460 }: { onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
        animation: "fadeIn 150ms ease both",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: "100%", maxWidth,
          position: "relative", overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "modalUp 200ms cubic-bezier(0.16,1,0.3,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Línea accent top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 0%, #2563eb 35%, #60a5fa 65%, transparent 100%)",
        }} />
        {children}
      </div>
    </div>
  );
}

/* ── Input/Select helper styles ── */
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 9, fontSize: 13,
  color: "var(--text-primary)", outline: "none",
  fontFamily: "inherit", transition: "border-color 150ms, box-shadow 150ms",
  boxSizing: "border-box",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
      {children}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   RegistrarEstacionModal — modal unificado
   • Con HWID  → zero-touch provisioning (estación arranca sola)
   • Sin HWID  → crea el dispositivo y muestra la api_key para copiar
   ══════════════════════════════════════════════════════════════════════ */
function RegistrarEstacionModal({ onClose, onDone, sucursales }: {
  onClose: () => void; onDone: () => void; sucursales: Sucursal[];
}) {
  const [nombre,     setNombre]     = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [hwid,       setHwid]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState<{
    mode: "zero-touch" | "manual";
    nombre: string;
    api_key?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const hwidClean = hwid.trim().toUpperCase();
  const isZeroTouch = hwidClean.length >= 8;

  async function handleSubmit() {
    if (!nombre.trim()) { setError("Escribe un nombre para la estación."); return; }
    setError(""); setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (isZeroTouch) {
        // ── Zero-touch: vincular por HWID ──────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: rpcErr } = await (supabase as any).rpc("vincular_estacion_hwid", {
          p_user_id:     userId,
          p_hwid:        hwidClean,
          p_nombre:      nombre.trim(),
          p_sucursal_id: sucursalId || null,
        });
        if (rpcErr) throw rpcErr;
        if (!data?.ok) throw new Error(data?.error ?? "Error al activar");
        setResult({ mode: "zero-touch", nombre: nombre.trim() });
      } else {
        // ── Manual: crear dispositivo vía API route ────────────────────
        const res = await fetch("/api/dispositivos/create", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: nombre.trim(), sucursal_id: sucursalId || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al crear");
        setResult({ mode: "manual", nombre: nombre.trim(), api_key: data.dispositivo.api_key });
      }
    } catch (e) {
      setError((e as Error).message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (!result?.api_key) return;
    navigator.clipboard.writeText(result.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const IconPC = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
  const IconCheck = ({ size = 22, color = "#22c55e" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  const IconSpin = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
    </svg>
  );

  return (
    <Modal onClose={onClose} maxWidth={460}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconPC />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
              {result ? "Estación registrada" : "Registrar estación"}
            </h2>
            {!result && <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>Conecta una máquina física al sistema</p>}
          </div>
        </div>
        <button onClick={onClose} style={btnGhost}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {!result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Nombre */}
          <div>
            <FieldLabel>Nombre de la estación <span style={{ color: "var(--accent)" }}>*</span></FieldLabel>
            <input
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Entrada Principal, Almacén Norte"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={inputStyle} autoFocus
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)";  e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          {/* Sucursal */}
          {sucursales.length > 0 && (
            <div>
              <FieldLabel>Sucursal <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Sin sucursal —</option>
                {sucursales.map(s => <option key={s.id} value={s.id} style={{ background: "#0f0f10" }}>{s.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Separador */}
          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          {/* HWID */}
          <div>
            <FieldLabel>
              ID de hardware&nbsp;
              <span style={{ color: "var(--text-faint)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                — déjalo vacío si aún no tienes la máquina encendida
              </span>
            </FieldLabel>
            <input
              value={hwid}
              onChange={(e) => setHwid(e.target.value.toUpperCase())}
              placeholder="Ej: 35D809933C5992C7  —  visible en la pantalla de la estación"
              style={{ ...inputStyle, fontFamily: "'Cascadia Code','Courier New',monospace", letterSpacing: "0.06em" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = isZeroTouch ? "#22c55e" : "var(--accent)"; e.currentTarget.style.boxShadow = `0 0 0 3px ${isZeroTouch ? "rgba(34,197,94,0.1)" : "rgba(37,99,235,0.1)"}`; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {/* Indicador de modo */}
            <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: isZeroTouch ? "#22c55e" : "#52525b", transition: "background 250ms", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isZeroTouch ? "#4ade80" : "var(--text-faint)", transition: "color 250ms" }}>
                {isZeroTouch
                  ? "Zero-touch — la estación arrancará automáticamente al registrar"
                  : "Sin HWID — se generará una API Key para copiar manualmente"}
              </span>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, padding: "9px 12px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            marginTop: 4, padding: "12px 20px",
            background: loading ? "rgba(37,99,235,0.4)" : "var(--accent)",
            color: "#fff", border: "none", borderRadius: 9,
            fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "inherit", transition: "background 200ms",
            boxShadow: loading ? "none" : "0 0 24px rgba(37,99,235,0.3)",
          }}>
            {loading && <IconSpin />}
            {loading ? "Registrando..." : "Registrar estación"}
          </button>
        </div>

      ) : result.mode === "zero-touch" ? (
        /* ── Éxito zero-touch ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 18, textAlign: "center" }}>
          <div style={{ padding: "28px 20px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <IconCheck />
            </div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#4ade80", marginBottom: 8, letterSpacing: "-0.02em" }}>¡Estación activada!</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text-muted)" }}>{result.nombre}</strong> fue registrada.<br />
              La estación detectará la activación en los próximos <strong style={{ color: "var(--text-muted)" }}>5 segundos</strong> y arrancará sola.
            </p>
          </div>
          <button onClick={() => { onDone(); onClose(); }} style={{
            padding: "12px 20px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 20px rgba(37,99,235,0.3)",
          }}>
            Ver estaciones
          </button>
        </div>

      ) : (
        /* ── Éxito manual: mostrar api_key ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconCheck size={14} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>¡Estación creada!</p>
              <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Copia la API Key a la máquina física para activarla.</p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.65 }}>
              Agrega esta variable al archivo <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> de la máquina:
            </p>
            <div style={{ background: "#000", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>.env</p>
              <code style={{ fontSize: 12, color: "#4ade80", fontFamily: "'Cascadia Code','Courier New',monospace", wordBreak: "break-all", lineHeight: 1.6 }}>
                STATION_API_KEY={result.api_key}
              </code>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={copyKey} style={{
              padding: "11px 20px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
              background: copied ? "rgba(34,197,94,0.1)" : "var(--bg-elevated)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
              color: copied ? "#4ade80" : "var(--text-primary)",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 200ms",
            }}>
              {copied
                ? <><IconCheck size={13} /> ¡Copiado!</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar API Key</>
              }
            </button>
            <button onClick={() => { onDone(); onClose(); }} style={{
              padding: "11px 20px", background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 20px rgba(37,99,235,0.3)",
            }}>
              Ver estaciones
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
            Guarda la API Key ahora — no se volverá a mostrar completa.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ── Toggle ── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 21, borderRadius: 99,
        background: value ? "var(--accent)" : "#27272a",
        border: "none", position: "relative", cursor: "pointer",
        transition: "background 200ms", flexShrink: 0,
        boxShadow: value ? "0 0 10px rgba(37,99,235,0.3)" : "none",
      }}
    >
      <div style={{
        position: "absolute", top: 2.5, left: value ? 19 : 2.5,
        width: 16, height: 16, background: "#fff", borderRadius: "50%",
        transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

/* ── Modal configurar ── */
function ConfigModal({ d, onClose, onOptimisticDelete, onOptimisticUpdate, sucursales }: {
  d: Dispositivo;
  onClose: () => void;
  onOptimisticDelete?: (id: string) => void;
  onOptimisticUpdate?: (d: Dispositivo) => void;
  sucursales: Sucursal[];
}) {
  const [nombre,     setNombre]     = useState(d.nombre);
  const [sucursalId, setSucursalId] = useState(d.sucursal_id || "");
  const [activo,     setActivo]     = useState(d.activo);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [syncMsg,    setSyncMsg]    = useState<{ ok: boolean; text: string } | null>(null);
  const supabase = createClient();

  async function save() {
    setSaving(true);
    // Optimistic update: actualizamos UI ya
    onOptimisticUpdate?.({
      ...d,
      nombre,
      sucursal_id: sucursalId || null,
      activo,
    });
    const res = await fetch("/api/dispositivos/update", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, nombre, sucursal_id: sucursalId || null, activo }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(onClose, 900); }
  }

  async function handleDelete() {
    // Optimistic delete: cerramos modal y removemos de la lista al instante
    onOptimisticDelete?.(d.id);
    onClose();
    // Fire and forget; si falla el server quedara desincronizado hasta el siguiente refresh
    fetch("/api/dispositivos/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id }),
    }).catch(() => { setDeleting(false); });
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc("enviar_comando_estacion", {
        p_dispositivo_id: d.id,
        p_tipo: "sync_empleados",
        p_payload: {},
      });
      if (rpcErr) throw rpcErr;
      if (data?.ok === false) throw new Error(data?.error ?? "Error al enviar comando");
      setSyncMsg({ ok: true, text: "Comando enviado — la estación sincronizará en breve." });
    } catch (e) {
      setSyncMsg({ ok: false, text: (e as Error).message ?? "Error al sincronizar" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={440}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>Configurar estación</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EstadoPill estado={d.estado_conexion} />
            {d.segundos_desde_heartbeat != null && (
              <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                heartbeat {fmtLabel(d.segundos_desde_heartbeat)}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={btnGhost}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <FieldLabel>Nombre</FieldLabel>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)";  e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        <div>
          <FieldLabel>Sucursal</FieldLabel>
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">— Sin sucursal —</option>
            {sucursales.map(s => <option key={s.id} value={s.id} style={{ background: "#0f0f10" }}>{s.nombre}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", background: "var(--bg-elevated)", borderRadius: 9, border: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 1 }}>Dispositivo activo</p>
            <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Si está desactivado, no aceptará registros.</p>
          </div>
          <Toggle value={activo} onChange={setActivo} />
        </div>

        {/* Sincronizar empleados */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
            Comandos remotos
          </p>
          <button onClick={handleSync} disabled={syncing} style={{
            width: "100%", padding: "9px 14px",
            background: syncing ? "rgba(37,99,235,0.15)" : "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: 8,
            color: syncing ? "var(--text-faint)" : "var(--text-muted)",
            fontSize: 12, fontWeight: 600, cursor: syncing ? "not-allowed" : "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
            transition: "all 150ms",
          }}
            onMouseEnter={(e) => { if (!syncing) { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.color = "var(--text-primary)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = syncing ? "var(--text-faint)" : "var(--text-muted)"; }}
          >
            {syncing
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            }
            {syncing ? "Enviando comando..." : "Sincronizar empleados"}
          </button>
          {syncMsg && (
            <p style={{ fontSize: 11, color: syncMsg.ok ? "#4ade80" : "#f87171", marginTop: 6 }}>
              {syncMsg.text}
            </p>
          )}
        </div>

        <button onClick={save} disabled={saving || saved} style={{
          padding: "11px 20px",
          background: saved ? "rgba(34,197,94,0.12)" : saving ? "rgba(37,99,235,0.4)" : "var(--accent)",
          color: saved ? "#4ade80" : "#fff",
          border: saved ? "1px solid rgba(34,197,94,0.25)" : "none",
          borderRadius: 9, fontSize: 13, fontWeight: 700,
          cursor: saving || saved ? "not-allowed" : "pointer",
          fontFamily: "inherit", transition: "all 200ms",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: saved || saving ? "none" : "0 0 20px rgba(37,99,235,0.25)",
        }}>
          {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>}
          {saved ? "✓ Cambios guardados" : saving ? "Guardando..." : "Guardar cambios"}
        </button>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} style={{
              background: "none", border: "none", color: "#ef4444",
              fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center", gap: 5,
              opacity: 0.7, transition: "opacity 150ms",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Eliminar esta estación
            </button>
          ) : (
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600, lineHeight: 1.5 }}>
                ¿Confirmas eliminar <strong>{d.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleDelete} disabled={deleting} style={{
                  flex: 1, padding: "8px", background: "#ef4444", color: "#fff",
                  border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button onClick={() => setShowDelete(false)} style={{
                  flex: 1, padding: "8px", background: "var(--bg-elevated)",
                  color: "var(--text-muted)", border: "1px solid var(--border)",
                  borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, color, icon, total }: {
  label: string; value: number; color: string; total: number;
  icon: React.ReactNode;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.05em", lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6 }}>{label}</p>
        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.8s ease" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "56px 32px", textAlign: "center",
      animation: "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 18px",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Sin estaciones registradas</p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 24, lineHeight: 1.6, maxWidth: 360, margin: "0 auto 24px" }}>
        Crea tu primera estación y copia la API Key al archivo <code style={{ fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4 }}>.env</code> de la máquina física.
      </p>
      <button onClick={onNew} style={{
        padding: "10px 22px", background: "var(--accent)", color: "#fff",
        border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        boxShadow: "0 0 20px rgba(37,99,235,0.3)",
        display: "inline-flex", alignItems: "center", gap: 7,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear primera estación
      </button>
    </div>
  );
}

/* ── Modal de logs de estación ── */
function LogsModal({ d, onClose }: { d: Dispositivo; onClose: () => void }) {
  const [logs, setLogs]       = useState<{ id: string; tipo: string; detalle: Record<string, unknown>; creado_en: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLogs() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("get_logs_dispositivo", {
        p_dispositivo_id: d.id,
        p_limit: 50,
      });
      setLogs(data?.logs ?? []);
      setLoading(false);
    }
    fetchLogs();
    // Realtime: escuchar nuevos logs de esta estación
    const channel = supabase
      .channel(`logs-${d.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "logs_estacion",
        filter: `dispositivo_id=eq.${d.id}`,
      }, (payload) => {
        setLogs(prev => [payload.new as typeof logs[0], ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);

  const TIPO_COLOR: Record<string, string> = {
    sync_ok: "#22c55e", sync_error: "#ef4444",
    reconocimiento_ok: "#60a5fa", reconocimiento_fallo: "#f59e0b",
    asistencia_registrada: "#22c55e", asistencia_offline: "#f59e0b",
    camara_error: "#ef4444", camara_ok: "#22c55e",
    error: "#ef4444", info: "#94a3b8",
  };

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Logs — {d.nombre}</h2>
          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Últimos 50 eventos · en tiempo real</p>
        </div>
        <button onClick={onClose} style={btnGhost}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {loading ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "32px 0" }}>Cargando logs...</p>
        ) : logs.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "32px 0" }}>Sin logs registrados aún</p>
        ) : logs.map(log => (
          <div key={log.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "8px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: TIPO_COLOR[log.tipo] ?? "#94a3b8", marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: TIPO_COLOR[log.tipo] ?? "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {log.tipo.replace(/_/g, " ")}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtTime(log.creado_en)}
                </span>
              </div>
              {Object.keys(log.detalle).length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.5, wordBreak: "break-word" }}>
                  {Object.entries(log.detalle).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ── Componente principal ── */
export function DispositivosClient({
  dispositivos: initial,
  initialSucursales = [],
}: {
  dispositivos: Dispositivo[];
  initialSucursales?: Sucursal[];
}) {
  const router                            = useRouter();
  const [dispositivos,  setDispositivos]  = useState(initial);
  const [showRegistrar,  setShowRegistrar]  = useState(false);
  const [selected,       setSelected]       = useState<Dispositivo | null>(null);
  const [logsDevice,     setLogsDevice]     = useState<Dispositivo | null>(null);
  const [realtimeOk,     setRealtimeOk]     = useState(false);
  const [sucursales]                       = useState<Sucursal[]>(initialSucursales);

  useEffect(() => { setDispositivos(initial); }, [initial]);

  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dispositivos-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "dispositivos" }, refresh)
      .subscribe((s) => setRealtimeOk(s === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  const total   = dispositivos.length;
  const online  = dispositivos.filter(d => d.estado_conexion === "online").length;
  const alerta  = dispositivos.filter(d => d.estado_conexion === "alerta").length;
  const offline = dispositivos.filter(d => ["offline","nunca"].includes(d.estado_conexion)).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>
      {showRegistrar && <RegistrarEstacionModal sucursales={sucursales} onClose={() => setShowRegistrar(false)} onDone={refresh} />}
      {selected      && <ConfigModal
        d={selected}
        sucursales={sucursales}
        onClose={() => setSelected(null)}
        onOptimisticDelete={(id) => setDispositivos((prev) => prev.filter((x) => x.id !== id))}
        onOptimisticUpdate={(updated) => setDispositivos((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x))}
      />}
      {logsDevice    && <LogsModal   d={logsDevice} onClose={() => setLogsDevice(null)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }} className="animate-fade-up">
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: 3, lineHeight: 1.2 }}>
            Estaciones
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: realtimeOk ? "#22c55e" : "#52525b",
              transition: "background 400ms",
              boxShadow: realtimeOk ? "0 0 8px rgba(34,197,94,0.6)" : "none",
            }} className={realtimeOk ? "animate-pulse-dot" : undefined} />
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {realtimeOk ? "Tiempo real activo" : "Conectando..."}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{total} estación{total !== 1 ? "es" : ""}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowRegistrar(true)} style={{
            padding: "9px 18px",
            background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 9,
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 7,
            boxShadow: "0 0 20px rgba(37,99,235,0.3)",
            transition: "opacity 150ms",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Registrar estación
          </button>

        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }} className="animate-fade-up">
        <StatCard label="En línea"   value={online}  color="#22c55e" total={total} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
        <StatCard label="Sin señal"  value={alerta}  color="#f59e0b" total={total} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        <StatCard label="Offline"    value={offline} color="#ef4444" total={total} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>} />
      </div>

      {/* Grid de cards */}
      {total > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 12 }}>
          {dispositivos.map((d, i) => (
            <DispositivoCard key={d.id} d={d} onConfig={setSelected} onLogs={setLogsDevice} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState onNew={() => setShowRegistrar(true)} />
      )}
    </div>
  );
}
