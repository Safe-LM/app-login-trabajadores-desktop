"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal, FieldLabel, btnGhost, inputStyle, type Dispositivo, type Sucursal } from "./_shared";
// Lazy-load: estos modales solo se abren ocasionalmente. Sacarlos del bundle
// inicial baja el JS de la pagina principal ~30%.
const RegistrarEstacionModal = dynamic(() => import("./RegistrarEstacionModal"), { ssr: false });
const LogsModal = dynamic(() => import("./LogsModal"), { ssr: false });
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
          ["Cámara",    camara === true ? "âœ“ OK" : camara === false ? "✗ Error" : "—", camara === true ? "#22c55e" : camara === false ? "#ef4444" : "var(--text-faint)"],
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
  const masked = `${apiKey.slice(0, 8)}${"â€¢".repeat(16)}`;
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
      <button onClick={() => setVis(!vis)} title={vis ? "Ocultar" : "Ver"} aria-label={vis ? "Ocultar API key" : "Ver API key"} style={btnGhost}>
        {vis
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        }
      </button>
      <button onClick={copy} title="Copiar" aria-label="Copiar API key al portapapeles" style={{ ...btnGhost, color: copied ? "#22c55e" : undefined }}>
        {copied
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        }
      </button>
    </div>
  );
}
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
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RegistrarEstacionModal — extraido a ./RegistrarEstacionModal.tsx
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
  const { notify } = useNotifications();

  async function save() {
    setSaving(true);
    onOptimisticUpdate?.({ ...d, nombre, sucursal_id: sucursalId || null, activo });
    try {
      const res = await fetch("/api/dispositivos/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, nombre, sucursal_id: sucursalId || null, activo }),
      });
      setSaving(false);
      if (res.ok) {
        setSaved(true);
        notify({ kind: "success", title: "Estación actualizada", message: nombre, duration: 3500 });
        setTimeout(onClose, 900);
      } else {
        const data = await res.json().catch(() => ({}));
        notify({ kind: "error", title: "No se pudo actualizar", message: data.error ?? "Error en el servidor" });
      }
    } catch (e) {
      setSaving(false);
      notify({ kind: "error", title: "Error de red", message: (e as Error).message ?? "" });
    }
  }

  async function handleDelete() {
    onOptimisticDelete?.(d.id);
    onClose();
    notify({ kind: "success", title: "Estación eliminada", message: d.nombre, duration: 3500 });
    try {
      const res = await fetch("/api/dispositivos/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify({ kind: "error", title: "No se pudo eliminar", message: data.error ?? "El servidor rechazó la operación" });
      }
    } catch {
      setDeleting(false);
      notify({ kind: "error", title: "Error de red", message: "No se pudo confirmar la eliminación" });
    }
  }
  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("enviar_comando_estacion", {
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
        <button onClick={onClose} aria-label="Cerrar configuración" style={btnGhost}>
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
          <button onClick={handleSync} disabled={syncing} className="btn btn-secondary btn-sm btn-block">
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
        <button onClick={save} disabled={saving || saved} className={`btn ${saved ? "btn-success" : "btn-primary"} btn-block`}>
          {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>}
          {saved ? "✓ Cambios guardados" : saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="btn btn-ghost btn-sm" style={{ color: "#ef4444", padding: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Eliminar esta estación
            </button>
          ) : (
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600, lineHeight: 1.5 }}>
                ¿Confirmas eliminar <strong>{d.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button onClick={() => setShowDelete(false)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
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
    <div className="card animate-fade-up" style={{
      padding: "64px 32px", textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      {/* Background pattern grid sutil */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(37,99,235,0.06) 1px, transparent 0)",
        backgroundSize: "20px 20px",
        opacity: 0.5,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "relative",
        width: 64, height: 64, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(37,99,235,0.14) 0%, rgba(37,99,235,0.04) 100%)",
        border: "1px solid rgba(37,99,235,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", color: "var(--accent-hover)",
        boxShadow: "0 12px 30px -10px rgba(37,99,235,0.5)",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <span style={{
          position: "absolute", inset: -6, borderRadius: 20,
          border: "1px solid rgba(37,99,235,0.18)",
          animation: "pulse-ring 2.4s cubic-bezier(0.16,1,0.3,1) infinite",
        }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em", position: "relative" }}>
        Sin estaciones registradas
      </p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 22, lineHeight: 1.65, maxWidth: 380, margin: "0 auto 22px", position: "relative" }}>
        Crea tu primera estación y copia la API Key al archivo <code style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 5, color: "#60a5fa", border: "1px solid rgba(37,99,235,0.15)" }}>.env</code> de la máquina física.
      </p>
      <button onClick={onNew} className="btn btn-primary" style={{ position: "relative" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Crear primera estación
      </button>
    </div>
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
      .on("postgres_changes", { event: "*", schema: "public", table: "dispositivos" }, (payload) => {
        // Aplicacion fina al estado local — sin full refetch
        if (payload.eventType === "INSERT") {
          // INSERT trae datos parciales; pedimos un refresh ligero solo en este caso
          refresh();
        } else if (payload.eventType === "UPDATE") {
          const updated = payload.new as Partial<Dispositivo> & { id: string };
          setDispositivos((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
        } else if (payload.eventType === "DELETE") {
          const deleted = payload.old as { id: string };
          setDispositivos((prev) => prev.filter((d) => d.id !== deleted.id));
        }
      })
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
      <PageHeader
        title="Estaciones"
        subtitle={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: realtimeOk ? "#22c55e" : "#52525b",
                boxShadow: realtimeOk ? "0 0 8px rgba(34,197,94,0.6)" : "none",
              }}
              className={realtimeOk ? "animate-pulse-dot" : undefined}
            />
            {realtimeOk ? "Tiempo real activo" : "Conectando..."}
          </span>
        }
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
        iconColor="#3b82f6"
        stats={[
          { label: "Total", value: total },
        ]}
        actions={
          <button onClick={() => setShowRegistrar(true)} className="btn btn-primary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Registrar estación
          </button>
        }
      />
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
