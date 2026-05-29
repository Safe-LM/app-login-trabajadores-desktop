"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { StatusBadge, type StatusKind } from "@/components/ui/StatusBadge";
import {
  Monitor, Plus, FileText, Settings, Eye, EyeOff, Copy, Check, AlertTriangle,
  Search, RefreshCw, Wifi, WifiOff, Cpu, HardDrive, ShieldCheck, Clock
} from "lucide-react";
import { Modal, FieldLabel, btnGhost, inputStyle, type Dispositivo, type Sucursal } from "./_shared";

// Lazy-load: estos modales solo se abren ocasionalmente. Sacarlos del bundle
// inicial baja el JS de la pagina principal ~30%.
const RegistrarEstacionModal = dynamic(() => import("./RegistrarEstacionModal"), { ssr: false });
const LogsModal = dynamic(() => import("./LogsModal"), { ssr: false });

const ESTADO: Record<Dispositivo["estado_conexion"], { color: string; border: string; glow: string; kind: StatusKind; label: string }> = {
  online:  { color: "#22c55e", border: "rgba(34,197,94,0.25)",  glow: "rgba(34,197,94,0.12)",  kind: "online",  label: "En línea"    },
  alerta:  { color: "#eab308", border: "rgba(234,179,8,0.25)",  glow: "rgba(234,179,8,0.12)",  kind: "warn",    label: "Sin señal"   },
  offline: { color: "#ef4444", border: "rgba(239,68,68,0.25)",  glow: "rgba(239,68,68,0.12)",  kind: "error",   label: "Offline"     },
  nunca:   { color: "#52525b", border: "rgba(82,82,91,0.25)",   glow: "rgba(82,82,91,0.10)",   kind: "neutral", label: "Sin activar" },
};

function fmtLabel(secs: number | null) {
  if (secs == null) return "Nunca";
  if (secs < 60)   return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)}h`;
  return `hace ${Math.floor(secs / 86400)}d`;
}

// Compara versiones semver ("5.7.10" > "5.7.3"). Devuelve <0, 0, >0.
function semverCmp(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/* ── Uptime bar visual ── */
function HeartbeatBar({ secs }: { secs: number | null }) {
  const max = 120;
  const pct = secs == null ? 0 : Math.max(0, Math.min(1, 1 - secs / max));
  const color = secs == null ? "#3f3f46" : secs <= 60 ? "#22c55e" : secs <= 300 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-faint)", minWidth: 32, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
        {fmtLabel(secs)}
      </span>
    </div>
  );
}

/* ── Health Score bar ── */
function HealthBar({ score, camara, empleados, syncAt, stale }: {
  score: number; camara: boolean | null; empleados: number; encodings: number; syncAt: string | null; stale?: boolean;
}) {
  const liveColor = score >= 80 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const color = stale ? "#52525b" : liveColor;
  const fmtSync = syncAt ? new Date(syncAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: stale ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          Diagnóstico del Sistema{stale && <span style={{ color: "#71717a", textTransform: "none", letterSpacing: 0 }}> (último dato)</span>}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{score}/100</span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 2 }}>
        {([
          ["Cámara",    camara === true ? "✓ OK" : camara === false ? "✗ Error" : "—", camara === true ? "#22c55e" : camara === false ? "#ef4444" : "var(--text-faint)"],
          ["Personal", String(empleados), empleados > 0 ? "#22c55e" : "var(--text-faint)"],
          ["Sincro",      fmtSync,          syncAt ? "#22c55e" : "var(--text-faint)"],
        ] as [string, string, string][]).map(([k, v, c]) => (
          <div key={k} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 6, padding: "5px 6px", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
            <p style={{ fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2 }}>{k}</p>
            <p style={{ fontSize: 10, fontWeight: 700, color: c, margin: 0 }}>{v}</p>
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
      <code style={{ flex: 1, fontSize: 10, color: "var(--text-faint)", fontFamily: "monospace, Courier", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
        {vis ? apiKey : masked}
      </code>
      <button onClick={() => setVis(!vis)} title={vis ? "Ocultar" : "Ver"} aria-label={vis ? "Ocultar API key" : "Ver API key"} style={btnGhost}>
        {vis ? <EyeOff size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={2} />}
      </button>
      <button onClick={copy} title="Copiar" aria-label="Copiar API key al portapapeles" style={{ ...btnGhost, color: copied ? "#22c55e" : undefined }}>
        {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2} />}
      </button>
    </div>
  );
}

/* ── Pill de estado (wrapper sobre StatusBadge) ── */
function EstadoPill({ estado }: { estado: keyof typeof ESTADO }) {
  const m = ESTADO[estado];
  return <StatusBadge kind={m.kind} label={m.label} strong={m.kind === "online"} />;
}

/* ── Card de dispositivo ── */
function DispositivoCard({ d, onConfig, onLogs, onPreview, latestVersion }: {
  d: Dispositivo;
  onConfig: (d: Dispositivo) => void;
  onLogs: (d: Dispositivo) => void;
  onPreview: (d: Dispositivo) => void;
  index: number;
  latestVersion: string | null;
}) {
  const m = ESTADO[d.estado_conexion];
  const isOffline = d.estado_conexion === "offline" || d.estado_conexion === "nunca";
  const appOutdated = !!(latestVersion && d.version_app && semverCmp(d.version_app, latestVersion) < 0);
  const sinEmpleados = (d.empleados_count ?? 0) === 0;
  const sinBiometria = !sinEmpleados && (d.encodings_version ?? 0) === 0;

  return (
    <div
      className="card estacion-tile dispositivos-industrial-card"
      data-status={m.kind}
      onClick={() => onPreview(d)}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 0,
        cursor: "pointer",
        border: `1px solid ${m.kind === "online" ? "rgba(34,197,94,0.22)" : "var(--border)"}`,
        boxShadow: `0 4px 15px rgba(0, 0, 0, 0.4), 0 0 10px ${m.glow}`,
        background: "var(--bg-card)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sheen sweep overlay */}
      <div className="card-sheen" />

      {/* Acento superior segun estado */}
      <div className="estacion-tile__accent" style={{ background: m.color }} />

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {/* Header: icono + nombre + estado */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div className="card-icon-ring" style={{
              width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
              background: m.kind === "online" ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${m.kind === "online" ? "rgba(34,197,94,0.20)" : "rgba(255,255,255,0.05)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: m.kind === "online" ? "#4ade80" : "var(--text-faint)",
            }}>
              <Monitor size={18} strokeWidth={1.5} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                {d.nombre}
              </p>
              <p style={{ fontSize: 9.5, color: "var(--text-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                {d.sucursal_nombre ?? "Sin sucursal"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <EstadoPill estado={d.estado_conexion} />
            {appOutdated && (
              <span
                title={`App en v${d.version_app}. Última disponible: v${latestVersion}. Actualiza el instalador en esta estación.`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.20)",
                  color: "#f87171", textTransform: "uppercase",
                  cursor: "help",
                }}
              >
                <AlertTriangle size={9} strokeWidth={2.5} />
                App v{d.version_app} · Update
              </span>
            )}
            {sinEmpleados && (
              <span
                title="Esta estación no tiene empleados cargados — no puede reconocer a nadie. Asigna empleados a esta sucursal."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(234,179,8,0.10)",
                  border: "1px solid rgba(234,179,8,0.18)",
                  color: "#facc15", textTransform: "uppercase",
                  cursor: "help",
                }}
              >
                <AlertTriangle size={9} strokeWidth={2.5} />
                Sin empleados
              </span>
            )}
            {sinBiometria && (
              <span
                title="La estación tiene empleados pero aún no ha generado los embeddings faciales."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(234,179,8,0.10)",
                  border: "1px solid rgba(234,179,8,0.18)",
                  color: "#facc15", textTransform: "uppercase",
                  cursor: "help",
                }}
              >
                <AlertTriangle size={9} strokeWidth={2.5} />
                Sin biometría
              </span>
            )}
          </div>
        </div>

        {/* Heartbeat bar */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Último Latido (Heartbeat)
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
          stale={isOffline}
        />

        {/* Grid de metadatos Hardware en Monospace */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px",
          background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.02)"
        }}>
          {([
            ["IP local",  d.ip_local   ?? "—"],
            ["Hostname",  d.hostname   ?? "—"],
            ["Hardware ID",      d.hwid ? `${d.hwid.slice(0, 10)}…` : "—"],
            ["Estación ID", d.id ? `${d.id.slice(0, 10)}…` : "—"]
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p style={{ fontSize: 8.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 2, margin: 0 }}>{k}</p>
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace, Courier", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* API Key Vault */}
        <div onClick={(e) => e.stopPropagation()} style={{
          padding: "8px 10px",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4, margin: 0 }}>API Key de la Estación</p>
          <ApiKey apiKey={d.api_key} />
        </div>

        {/* Footer: creador + acciones */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
          {d.creado_por ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 800, color: "var(--accent-hover)",
              }}>
                {d.creado_por[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80, fontWeight: 500 }} title={d.creado_por}>
                {d.creado_por}
              </span>
            </div>
          ) : <span />}
          <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onLogs(d)} className="btn btn-ghost btn-sm" title="Ver logs" style={{ padding: "4px 8px" }}>
              <FileText size={12} strokeWidth={2} />
              Logs
            </button>
            <button onClick={() => onConfig(d)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>
              <Settings size={12} strokeWidth={2} />
              Configurar
            </button>
          </div>
        </div>
      </div>
    </div>
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

// ─── Componente de botón de comando remoto ───
type CmdBtnState = {
  sending: boolean;
  id: string | null;
  ejecutado_en: string | null;
  error: string | null;
  status: "idle" | "pending" | "executed" | "failed";
};
function CommandButton({
  label, hint, state, onClick, icon, variant = "secondary",
}: {
  tipo: string;
  label: string;
  hint: string;
  state: CmdBtnState;
  onClick: () => void;
  icon: React.ReactNode;
  variant?: "secondary" | "warning";
}) {
  const disabled = state.sending || state.status === "pending";
  return (
    <div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="btn btn-sm btn-block btn-secondary"
        style={{
          justifyContent: "flex-start",
          opacity: disabled ? 0.7 : 1,
          ...(variant === "warning" ? { borderColor: "rgba(245,158,11,0.3)" } : {}),
        }}
      >
        {state.sending || state.status === "pending"
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>
          : icon}
        <span style={{ flex: 1, textAlign: "left", marginLeft: 4 }}>
          {state.sending ? "Enviando..." : label}
        </span>
        <CmdStatusBadge state={state} />
      </button>
      <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, marginLeft: 4, margin: "2px 0 0 4px" }}>
        {hint}
      </p>
    </div>
  );
}

function CmdStatusBadge({ state }: { state: CmdBtnState }) {
  if (state.status === "idle") return null;
  const meta: Record<string, { bg: string; fg: string; label: string }> = {
    pending:  { bg: "rgba(245,158,11,0.15)", fg: "#fbbf24", label: "Pendiente" },
    executed: { bg: "rgba(16,185,129,0.15)", fg: "#4ade80", label: "Ejecutado" },
    failed:   { bg: "rgba(239,68,68,0.15)",  fg: "#f87171", label: "Error" },
  };
  const m = meta[state.status];
  if (!m) return null;
  return (
    <span
      title={state.ejecutado_en
        ? `Ejecutado: ${new Date(state.ejecutado_en).toLocaleTimeString("es-MX")}`
        : state.error ?? "Esperando respuesta de la estación..."}
      style={{
        fontSize: 9, padding: "1px 6px", borderRadius: 4,
        background: m.bg, color: m.fg, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}
    >
      {m.label}
    </span>
  );
}

/* ── Modal configurar ── */
function ConfigModal({ d, onClose, onOptimisticDelete, onOptimisticUpdate, sucursalId: propSucursalId, sucursales }: {
  d: Dispositivo;
  onClose: () => void;
  onOptimisticDelete?: (id: string) => void;
  onOptimisticUpdate?: (d: Dispositivo) => void;
  sucursalId?: string; // Fallback opcional para tipado
  sucursales: Sucursal[];
}) {
  const [nombre,     setNombre]     = useState(d.nombre);
  const [sucursalId, setSucursalId] = useState(d.sucursal_id || "");
  const [activo,     setActivo]     = useState(d.activo);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  type CmdType = "sync_empleados" | "reiniciar_app" | "limpiar_cache";
  const initCmd: CmdBtnState = { sending: false, id: null, ejecutado_en: null, error: null, status: "idle" };
  const [cmdState, setCmdState] = useState<Record<CmdType, CmdBtnState>>({
    sync_empleados: initCmd,
    reiniciar_app:  initCmd,
    limpiar_cache:  initCmd,
  });

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
    setDeleting(true);
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
      notify({ kind: "error", title: "Error de red", message: "No se pudo confirmar la eliminación" });
    } finally {
      setDeleting(false);
    }
  }

  async function sendCommand(tipo: CmdType) {
    const estaOffline = d.estado_conexion === "offline" || d.estado_conexion === "nunca";
    setCmdState(prev => ({ ...prev, [tipo]: { ...initCmd, sending: true } }));
    try {
      const { data, error: rpcErr } = await supabase.rpc("enviar_comando_estacion", {
        p_dispositivo_id: d.id,
        p_tipo: tipo,
        p_payload: {},
      });
      if (rpcErr) throw rpcErr;
      if (data?.ok === false) throw new Error(data?.error ?? "Error al enviar comando");
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmdId = ((data as any)?.comando_id ?? (data as any)?.id ?? null) as string | null;
      setCmdState(prev => ({
        ...prev,
        [tipo]: { sending: false, id: cmdId, ejecutado_en: null, error: null, status: "pending" },
      }));

      if (estaOffline) {
        notify({
          kind: "info",
          title: "Comando en cola",
          message: "La estación está offline. Se aplicará automáticamente cuando reconecte.",
          duration: 5000,
        });
      }
    } catch (e) {
      const msg = (e as Error).message ?? "Error al enviar comando";
      setCmdState(prev => ({
        ...prev,
        [tipo]: { sending: false, id: null, ejecutado_en: null, error: msg, status: "failed" },
      }));
    }
  }

  // Polling cada 3s para ver si la station ejecuto el comando.
  useEffect(() => {
    const pendings = Object.entries(cmdState).filter(
      ([, st]) => st.status === "pending" && st.id
    );
    if (pendings.length === 0) return;

    let attempts = 0;
    const maxAttempts = 20;  // 60s timeout
    const interval = setInterval(async () => {
      attempts++;
      const ids = pendings.map(([, st]) => st.id).filter(Boolean) as string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data } = await sb
        .from("comandos_estacion")
        .select("id, tipo, ejecutado_en, resultado")
        .in("id", ids);
      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of data as any[]) {
          if (row.ejecutado_en) {
            setCmdState(prev => ({
              ...prev,
              [row.tipo as CmdType]: {
                sending: false,
                id: row.id,
                ejecutado_en: row.ejecutado_en,
                error: row.resultado && row.resultado !== "ok" ? row.resultado : null,
                status: row.resultado && row.resultado !== "ok" ? "failed" : "executed",
              },
            }));
          }
        }
      }
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
  }, [cmdState, supabase]);

  return (
    <Modal onClose={onClose} maxWidth={440}>
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
          <FieldLabel>Nombre de la Estación</FieldLabel>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.1)"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)";  e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <div>
          <FieldLabel>Sucursal Asignada</FieldLabel>
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
        {/* Comandos remotos */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
            Comandos remotos
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <CommandButton
              tipo="sync_empleados"
              label="Sincronizar empleados"
              hint="Fuerza descarga de fotos y embeddings faciales"
              state={cmdState.sync_empleados}
              onClick={() => sendCommand("sync_empleados")}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
            />
            <CommandButton
              tipo="limpiar_cache"
              label="Limpiar caché y reindexar"
              hint="Borra base local de embeddings y reconstruye"
              state={cmdState.limpiar_cache}
              onClick={() => sendCommand("limpiar_cache")}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>}
            />
            <CommandButton
              tipo="reiniciar_app"
              label="Reiniciar aplicación"
              hint="Fuerza el reinicio de la estación física"
              state={cmdState.reiniciar_app}
              onClick={() => sendCommand("reiniciar_app")}
              variant="warning"
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
            />
          </div>
        </div>
        <button onClick={save} disabled={saving || saved} className={`btn ${saved ? "btn-success" : "btn-primary"} btn-block`}>
          {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>}
          {saved ? "✓ Cambios guardados" : saving ? "Guardando..." : "Guardar configuración"}
        </button>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="btn btn-ghost btn-sm" style={{ color: "#ef4444", padding: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Eliminar esta estación definitivamente
            </button>
          ) : (
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600, lineHeight: 1.5 }}>
                ¿Confirmas eliminar <strong>{d.nombre}</strong>? Esta acción no se puede deshacer y desconectará la estación física.
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

/* ── Quick Preview Modal ── */
function QuickPreviewModal({ d, onClose, onConfig, onLogs }: {
  d: Dispositivo;
  onClose: () => void;
  onConfig: (d: Dispositivo) => void;
  onLogs: (d: Dispositivo) => void;
}) {
  const m = ESTADO[d.estado_conexion];
  const isOffline = d.estado_conexion === "offline" || d.estado_conexion === "nunca";
  const fmtSync = d.ultimo_sync_at ? new Date(d.ultimo_sync_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtHeartbeat = d.heartbeat_at ? new Date(d.heartbeat_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const healthColor = (d.health_score ?? 0) >= 80 ? "#22c55e" : (d.health_score ?? 0) >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="preview-modal-overlay"
      onClick={onClose}
    >
      <div
        className="preview-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bar top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent 0%, ${m.color} 30%, ${m.color} 70%, transparent 100%)` }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: `${m.glow}`,
              border: `1.5px solid ${m.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: m.color,
              boxShadow: `0 0 20px ${m.glow}`,
            }}>
              <Monitor size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>{d.nombre}</h2>
              <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "3px 0 0 0", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{d.sucursal_nombre ?? "Sin sucursal asignada"}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EstadoPill estado={d.estado_conexion} />
            <button onClick={onClose} aria-label="Cerrar" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Health Score Highlight */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", borderRadius: 10,
          background: isOffline ? "rgba(255,255,255,0.015)" : `linear-gradient(135deg, rgba(0,0,0,0.3) 0%, ${m.glow} 100%)`,
          border: `1px solid ${m.border}`,
          marginBottom: 16
        }}>
          <div>
            <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "0 0 4px 0" }}>Salud del Sistema</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: isOffline ? "var(--text-faint)" : healthColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{d.health_score ?? 0}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>/100</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Cámara", d.camara_ok === true ? "✓" : d.camara_ok === false ? "✗" : "—", d.camara_ok === true ? "#22c55e" : d.camara_ok === false ? "#ef4444" : "#52525b"] as [string, string, string]).length > 0 && (
              <div style={{ textAlign: "center", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8, minWidth: 50 }}>
                <p style={{ fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, margin: "0 0 2px 0" }}>Cámara</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: d.camara_ok === true ? "#22c55e" : d.camara_ok === false ? "#ef4444" : "var(--text-faint)", margin: 0 }}>{d.camara_ok === true ? "OK" : d.camara_ok === false ? "Error" : "—"}</p>
              </div>
            )}
            <div style={{ textAlign: "center", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8, minWidth: 50 }}>
              <p style={{ fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, margin: "0 0 2px 0" }}>Personal</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: (d.empleados_count ?? 0) > 0 ? "#22c55e" : "var(--text-faint)", margin: 0 }}>{d.empleados_count ?? 0}</p>
            </div>
            <div style={{ textAlign: "center", padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8, minWidth: 50 }}>
              <p style={{ fontSize: 8, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, margin: "0 0 2px 0" }}>Sincro</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: d.ultimo_sync_at ? "#22c55e" : "var(--text-faint)", margin: 0 }}>{fmtSync}</p>
            </div>
          </div>
        </div>

        {/* Technical Details Grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px",
          background: "rgba(0,0,0,0.15)", padding: "14px 16px", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.03)", marginBottom: 16
        }}>
          {([
            ["IP Local", d.ip_local ?? "—"],
            ["Hostname", d.hostname ?? "—"],
            ["Hardware ID", d.hwid ?? "—"],
            ["Versión de App", d.version_app ? `v${d.version_app}` : "—"],
            ["Último Heartbeat", fmtHeartbeat],
            ["Latido", fmtLabel(d.segundos_desde_heartbeat)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, margin: "0 0 3px 0" }}>{k}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace, Courier", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Actions Footer */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { onClose(); onLogs(d); }}
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}
          >
            <FileText size={13} strokeWidth={2} />
            Ver Logs
          </button>
          <button
            onClick={() => { onClose(); onConfig(d); }}
            className="btn btn-primary btn-sm"
            style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}
          >
            <Settings size={13} strokeWidth={2} />
            Configurar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Metric chip (Consistente con toolbar) ── */
function MetricChip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="metric-chip" style={{ "--mc": color } as React.CSSProperties}>
      <span className="metric-chip__dot" />
      <span className="metric-chip__label">{label}</span>
      <span className="metric-chip__value">{value}</span>
    </div>
  );
}

/* ── Empty state ── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="empty-state animate-fade-up" style={{ marginTop: 8 }}>
      <div className="empty-state-icon">
        <Monitor size={22} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
        Sin estaciones registradas
      </h3>
      <p className="text-muted-sm" style={{ maxWidth: 380 }}>
        Crea tu primera estación y copia la API Key al archivo <code style={{
          fontSize: 11, background: "var(--bg-elevated)", padding: "2px 6px",
          borderRadius: 5, color: "var(--accent-hover)",
          border: "1px solid var(--border)",
        }}>.env</code> de la máquina física.
      </p>
      <button onClick={onNew} className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
        <Plus size={14} strokeWidth={2.5} />
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
  const [previewDevice,  setPreviewDevice]  = useState<Dispositivo | null>(null);
  const [realtimeOk,     setRealtimeOk]     = useState(false);
  const [sucursales]                       = useState<Sucursal[]>(initialSucursales);
  const { notify }                         = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  // Latencia de red a Supabase
  useEffect(() => {
    const supabase = createClient();
    async function measurePing() {
      const start = performance.now();
      try {
        await supabase.from("dispositivos").select("id", { count: "exact", head: true }).limit(1);
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (err) {
        console.error("Error midiendo ping:", err);
        setLatency(null);
      }
    }
    measurePing();
    const interval = setInterval(measurePing, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("search");
      if (s) setSearchTerm(s);
    }
  }, []);

  useEffect(() => { setDispositivos(initial); }, [initial]);
  
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    router.refresh();
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsRefreshing(false);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dispositivos-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "dispositivos" }, (payload) => {
        if (payload.eventType === "INSERT") {
          router.refresh();
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
  }, [router]);

  const total   = dispositivos.length;
  const online  = dispositivos.filter(d => d.estado_conexion === "online").length;
  const alerta  = dispositivos.filter(d => d.estado_conexion === "alerta").length;
  const offline = dispositivos.filter(d => ["offline","nunca"].includes(d.estado_conexion)).length;

  const latestVersion = useMemo(() => {
    return dispositivos.reduce<string | null>(
      (mx, d) => d.version_app && (!mx || semverCmp(d.version_app, mx) > 0) ? d.version_app : mx,
      null
    );
  }, [dispositivos]);

  // Alertas del sistema
  const systemAlertsCount = useMemo(() => {
    return dispositivos.reduce((acc, d) => {
      const appOutdated = !!(latestVersion && d.version_app && semverCmp(d.version_app, latestVersion) < 0);
      const sinEmpleados = (d.empleados_count ?? 0) === 0;
      const sinBiometria = !sinEmpleados && (d.encodings_version ?? 0) === 0;
      if (appOutdated || sinEmpleados || sinBiometria || d.estado_conexion === "offline" || d.estado_conexion === "alerta") {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [dispositivos, latestVersion]);

  // Eficiencia y Salud promedio
  const fleetEfficiency = total > 0 ? Math.round((online / total) * 100) : 0;
  const avgHealth = total > 0
    ? Math.round(dispositivos.reduce((acc, curr) => acc + (curr.health_score ?? 0), 0) / total)
    : 0;

  // Filtrado de dispositivos
  const filteredDispositivos = useMemo(() => {
    let result = dispositivos;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(d => 
        (d.nombre || "").toLowerCase().includes(q) || 
        (d.sucursal_nombre || "").toLowerCase().includes(q)
      );
    }

    if (selectedStateFilter !== "all") {
      if (selectedStateFilter === "online") {
        result = result.filter(d => d.estado_conexion === "online");
      } else if (selectedStateFilter === "alerta") {
        result = result.filter(d => d.estado_conexion === "alerta");
      } else if (selectedStateFilter === "offline") {
        result = result.filter(d => ["offline", "nunca"].includes(d.estado_conexion));
      } else if (selectedStateFilter === "alertas") {
        result = result.filter(d => {
          const appOutdated = !!(latestVersion && d.version_app && semverCmp(d.version_app, latestVersion) < 0);
          const sinEmpleados = (d.empleados_count ?? 0) === 0;
          const sinBiometria = !sinEmpleados && (d.encodings_version ?? 0) === 0;
          return appOutdated || sinEmpleados || sinBiometria || d.estado_conexion === "offline" || d.estado_conexion === "alerta";
        });
      }
    }

    return result;
  }, [dispositivos, searchTerm, selectedStateFilter, latestVersion]);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1280, margin: "0 auto" }} className="animate-fade-up">
      {showRegistrar && <RegistrarEstacionModal sucursales={sucursales} onClose={() => setShowRegistrar(false)} onDone={refresh} />}
      {selected      && <ConfigModal
        d={selected}
        sucursales={sucursales}
        onClose={() => setSelected(null)}
        onOptimisticDelete={(id) => setDispositivos((prev) => prev.filter((x) => x.id !== id))}
        onOptimisticUpdate={(updated) => setDispositivos((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x))}
      />}
      {logsDevice    && <LogsModal   d={logsDevice} onClose={() => setLogsDevice(null)} />}
      {previewDevice && <QuickPreviewModal d={previewDevice} onClose={() => setPreviewDevice(null)} onConfig={setSelected} onLogs={setLogsDevice} />}
      
      {/* Cabecera */}
      <header className="tablero-hero" style={{ marginBottom: 20 }}>
        <div className="tablero-hero__title">
          <h1 className="heading-1" style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "0 0 4px 0" }}>
            <span>Estaciones</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", marginRight: 6 }}>·</span>
              {total} {total === 1 ? "estación" : "estaciones"}
            </span>
          </h1>
          <p className="text-muted-sm" style={{ margin: 0 }}>Consola de gestión de hardware y terminales de biometría Safe Link</p>
        </div>
        <div className="tablero-hero__metrics">
          <div className="tablero-hero__live" style={{ marginRight: 6 }}>
            <StatusBadge
              kind={realtimeOk ? "live" : "offline"}
              label={realtimeOk ? "En vivo" : "Sin conexión"}
              strong={realtimeOk}
            />
          </div>
          <button
            onClick={() => setShowRegistrar(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            Registrar estación
          </button>
        </div>
      </header>

      {/* Consola Superior NOC (Salud de Flota) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Eficiencia de Flota</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {fleetEfficiency}%
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(34,197,94,0.08)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wifi size={16} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Salud Hardware</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {avgHealth}%
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(59,130,246,0.08)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Monitor size={16} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ping API (Supabase)</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: latency && latency < 150 ? "#4ade80" : latency && latency < 350 ? "#facc15" : "#f87171", fontVariantNumeric: "tabular-nums" }}>
              {latency ? `${latency} ms` : "—"}
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: latency && latency < 150 ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", color: latency && latency < 150 ? "#22c55e" : "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Alertas Activas</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: systemAlertsCount > 0 ? "#f87171" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {systemAlertsCount}
            </span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: systemAlertsCount > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)", color: systemAlertsCount > 0 ? "#ef4444" : "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      {/* Toolbar: Filtros y Buscador */}
      <div className="dispositivos-toolbar animate-fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20 }}>
        {/* Segmented */}
        <div className="segmented" role="tablist" aria-label="Filtro por estado de conexión">
          <button
            type="button"
            className={"segmented__btn" + (selectedStateFilter === "all" ? " is-active" : "")}
            onClick={() => setSelectedStateFilter("all")}
          >
            Todas <span className="segmented-count">{total}</span>
          </button>
          <button
            type="button"
            className={"segmented__btn" + (selectedStateFilter === "online" ? " is-active" : "")}
            onClick={() => setSelectedStateFilter("online")}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", marginRight: 4, display: "inline-block" }} />
            Online <span className="segmented-count">{online}</span>
          </button>
          <button
            type="button"
            className={"segmented__btn" + (selectedStateFilter === "alerta" ? " is-active" : "")}
            onClick={() => setSelectedStateFilter("alerta")}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#eab308", marginRight: 4, display: "inline-block" }} />
            Lag <span className="segmented-count">{alerta}</span>
          </button>
          <button
            type="button"
            className={"segmented__btn" + (selectedStateFilter === "offline" ? " is-active" : "")}
            onClick={() => setSelectedStateFilter("offline")}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", marginRight: 4, display: "inline-block" }} />
            Offline <span className="segmented-count">{offline}</span>
          </button>
          {systemAlertsCount > 0 && (
            <button
              type="button"
              className={"segmented__btn" + (selectedStateFilter === "alertas" ? " is-active" : "")}
              onClick={() => setSelectedStateFilter("alertas")}
              style={{ color: "#f87171" }}
            >
              <AlertTriangle size={11} style={{ marginRight: 4, display: "inline-block" }} />
              Con Alertas <span className="segmented-count" style={{ color: "#f87171" }}>{systemAlertsCount}</span>
            </button>
          )}
        </div>

        {/* Buscador */}
        <div style={{ position: "relative", width: 260 }} className="dispositivos-search">
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="text"
            placeholder="Buscar estación por nombre o sucursal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%", padding: "7px 10px 7px 30px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 12, color: "var(--text-primary)",
              outline: "none", transition: "all 0.15s ease"
            }}
            className="dispositivos-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
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

        {/* Refresh manual */}
        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing}
          className="btn btn-ghost btn-sm"
          title="Refrescar flota"
          style={{ padding: 8, opacity: isRefreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={13} className={isRefreshing ? "animate-spin-custom" : ""} />
        </button>
      </div>

      {/* Grid de cards */}
      {total > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }} className="stagger-fade-up">
          {filteredDispositivos.map((d, i) => (
            <DispositivoCard
              key={d.id}
              d={d}
              onConfig={setSelected}
              onLogs={setLogsDevice}
              onPreview={setPreviewDevice}
              index={i}
              latestVersion={latestVersion}
            />
          ))}
        </div>
      ) : (
        <EmptyState onNew={() => setShowRegistrar(true)} />
      )}

      {/* Keyframes y estilos específicos */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 0.8s linear infinite;
        }
        .dispositivos-search-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important;
        }

        /* ── Card hover effects ── */
        .dispositivos-industrial-card {
          transform: translateY(0) scale(1);
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1),
                      border-color 0.25s ease,
                      box-shadow 0.35s ease !important;
        }
        .dispositivos-industrial-card:hover {
          transform: translateY(-4px) scale(1.012);
          border-color: rgba(59,130,246,0.35) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5),
                      0 0 20px rgba(59,130,246,0.12),
                      0 0 0 1px rgba(59,130,246,0.15) !important;
        }
        .dispositivos-industrial-card[data-status="online"]:hover {
          border-color: rgba(34,197,94,0.4) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5),
                      0 0 25px rgba(34,197,94,0.15),
                      0 0 0 1px rgba(34,197,94,0.20) !important;
        }
        .dispositivos-industrial-card[data-status="warn"]:hover {
          border-color: rgba(234,179,8,0.4) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5),
                      0 0 25px rgba(234,179,8,0.12),
                      0 0 0 1px rgba(234,179,8,0.18) !important;
        }
        .dispositivos-industrial-card[data-status="error"]:hover {
          border-color: rgba(239,68,68,0.4) !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5),
                      0 0 25px rgba(239,68,68,0.12),
                      0 0 0 1px rgba(239,68,68,0.18) !important;
        }

        /* Sheen sweep */
        .card-sheen {
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%);
          pointer-events: none;
          z-index: 1;
          transition: none;
        }
        .dispositivos-industrial-card:hover .card-sheen {
          animation: sheenSweep 0.6s ease forwards;
        }
        @keyframes sheenSweep {
          from { left: -100%; }
          to   { left: 200%; }
        }

        /* Icon ring glow on hover */
        .dispositivos-industrial-card:hover .card-icon-ring {
          box-shadow: 0 0 12px rgba(59,130,246,0.2);
        }
        .dispositivos-industrial-card[data-status="online"]:hover .card-icon-ring {
          box-shadow: 0 0 12px rgba(34,197,94,0.25);
        }

        /* ── Quick Preview Modal ── */
        .preview-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 16px;
          animation: previewFadeIn 0.2s ease both;
        }
        @keyframes previewFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .preview-modal-content {
          background: rgba(17,17,20,0.96);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 28px;
          width: 100%; max-width: 520px;
          position: relative; overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7),
                      0 0 0 1px rgba(255,255,255,0.04),
                      0 0 60px rgba(59,130,246,0.06);
          animation: previewSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes previewSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .segmented-count {
          font-variant-numeric: tabular-nums;
          font-size: 10px;
          font-weight: 700;
          margin-left: 4px;
          color: var(--text-faint);
        }
        .segmented__btn.is-active .segmented-count {
          color: var(--text-primary);
        }
      `}} />
    </div>
  );
}
