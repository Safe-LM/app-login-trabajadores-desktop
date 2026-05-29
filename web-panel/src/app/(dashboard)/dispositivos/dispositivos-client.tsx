"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { StatusBadge, type StatusKind } from "@/components/ui/StatusBadge";
import {
  Monitor, Plus, FileText, Settings, Eye, EyeOff, Copy, Check, AlertTriangle,
} from "lucide-react";
import { Modal, FieldLabel, btnGhost, inputStyle, type Dispositivo, type Sucursal } from "./_shared";
// Lazy-load: estos modales solo se abren ocasionalmente. Sacarlos del bundle
// inicial baja el JS de la pagina principal ~30%.
const RegistrarEstacionModal = dynamic(() => import("./RegistrarEstacionModal"), { ssr: false });
const LogsModal = dynamic(() => import("./LogsModal"), { ssr: false });
const ESTADO: Record<Dispositivo["estado_conexion"], { color: string; border: string; kind: StatusKind; label: string }> = {
  online:  { color: "#22c55e", border: "rgba(34,197,94,0.22)",  kind: "online",  label: "En línea"    },
  alerta:  { color: "#eab308", border: "rgba(234,179,8,0.22)",  kind: "warn",    label: "Sin señal"   },
  offline: { color: "#ef4444", border: "rgba(239,68,68,0.22)",  kind: "error",   label: "Offline"     },
  nunca:   { color: "#52525b", border: "rgba(82,82,91,0.22)",   kind: "neutral", label: "Sin activar" },
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
function HealthBar({ score, camara, empleados, syncAt, stale }: {
  score: number; camara: boolean | null; empleados: number; encodings: number; syncAt: string | null; stale?: boolean;
}) {
  // Si la estación está offline, la salud es el ÚLTIMO dato conocido, no el
  // actual. La atenuamos y lo etiquetamos para no dar falsa sensación de "OK".
  const liveColor = score >= 80 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const color = stale ? "#52525b" : liveColor;
  const fmtSync = syncAt ? new Date(syncAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: stale ? 0.65 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          Salud del sistema{stale && <span style={{ color: "#71717a", textTransform: "none", letterSpacing: 0 }}> · último dato</span>}
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
function DispositivoCard({ d, onConfig, onLogs, latestVersion }: {
  d: Dispositivo;
  onConfig: (d: Dispositivo) => void;
  onLogs: (d: Dispositivo) => void;
  index: number;
  latestVersion: string | null;
}) {
  const m = ESTADO[d.estado_conexion];
  const isOffline = d.estado_conexion === "offline" || d.estado_conexion === "nunca";
  // App desactualizada: su version de app es menor a la mas alta vista en la flota.
  const appOutdated = !!(latestVersion && d.version_app && semverCmp(d.version_app, latestVersion) < 0);
  // Señal REAL de "no lista para reconocer": sin empleados cargados o sin
  // biometría generada. (Antes se comparaba el mtime del .pkl entre estaciones,
  // que es local a cada máquina y nunca se iguala → era ruido.)
  const sinEmpleados = (d.empleados_count ?? 0) === 0;
  const sinBiometria = !sinEmpleados && (d.encodings_version ?? 0) === 0;
  return (
    <div
      className="card estacion-tile"
      data-status={m.kind}
      style={{ display: "flex", flexDirection: "column", padding: 0 }}
    >
      {/* Acento superior segun estado */}
      <div className="estacion-tile__accent" style={{ background: m.color }} />

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {/* Header: icono + nombre + estado */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "var(--radius-md)", flexShrink: 0,
              background: m.kind === "online" ? "rgba(34,197,94,0.10)" : "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: m.kind === "online" ? "#4ade80" : "var(--text-faint)",
            }}>
              <Monitor size={16} strokeWidth={1.75} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.nombre}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171", textTransform: "uppercase",
                  cursor: "help",
                }}
              >
                <AlertTriangle size={9} strokeWidth={2.5} />
                App v{d.version_app} · update
              </span>
            )}
            {sinEmpleados && (
              <span
                title="Esta estación no tiene empleados cargados — no puede reconocer a nadie. Forza un sync de empleados o verifica que la sucursal tenga personal asignado."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(234,179,8,0.10)",
                  border: "1px solid rgba(234,179,8,0.22)",
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
                title="La estación tiene empleados pero aún no ha generado los embeddings faciales. Se generan en el primer sync con fotos disponibles."
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  padding: "2px 6px", borderRadius: 4,
                  background: "rgba(234,179,8,0.10)",
                  border: "1px solid rgba(234,179,8,0.22)",
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
          stale={isOffline}
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
            <button onClick={() => onLogs(d)} className="btn btn-ghost btn-sm" title="Ver logs">
              <FileText size={11} strokeWidth={2} />
              Logs
            </button>
            <button onClick={() => onConfig(d)} className="btn btn-secondary btn-sm">
              <Settings size={11} strokeWidth={2} />
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
// ─── Componente reutilizable: boton de comando con badge de estado ───
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
        className={`btn btn-sm btn-block ${variant === "warning" ? "btn-secondary" : "btn-secondary"}`}
        style={{
          justifyContent: "flex-start",
          opacity: disabled ? 0.7 : 1,
          ...(variant === "warning" ? { borderColor: "rgba(245,158,11,0.3)" } : {}),
        }}
      >
        {state.sending || state.status === "pending"
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>
          : icon}
        <span style={{ flex: 1, textAlign: "left" }}>
          {state.sending ? "Enviando..." : label}
        </span>
        <CmdStatusBadge state={state} />
      </button>
      <p style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, marginLeft: 4 }}>
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
  // Estado de cada comando remoto (S1.1 + S1.2)
  type CmdType = "sync_empleados" | "reiniciar_app" | "limpiar_cache";
  type CmdState = {
    sending: boolean;
    id: string | null;         // id del comando en DB para hacer polling
    ejecutado_en: string | null;
    error: string | null;
    status: "idle" | "pending" | "executed" | "failed";
  };
  const initCmd: CmdState = { sending: false, id: null, ejecutado_en: null, error: null, status: "idle" };
  const [cmdState, setCmdState] = useState<Record<CmdType, CmdState>>({
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
  // ─── S1.1 + S1.2: enviar comando + tracking de ejecucion ──────
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
      // El RPC devuelve { ok: true, comando_id } o solo { ok: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmdId = ((data as any)?.comando_id ?? (data as any)?.id ?? null) as string | null;
      setCmdState(prev => ({
        ...prev,
        [tipo]: { sending: false, id: cmdId, ejecutado_en: null, error: null, status: "pending" },
      }));
      // UX: si la estación está offline, el comando queda en cola — avisamos
      // para que el admin no espere un cambio inmediato que no llegará hasta
      // que la estación reconecte.
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
  // Solo activa cuando hay un comando "pending" sin ejecutar todavia.
  // Se detiene a los 60s para no spamear si la station esta caida.
  useEffect(() => {
    const pendings = Object.entries(cmdState).filter(
      ([, st]) => st.status === "pending" && st.id
    );
    if (pendings.length === 0) return;

    let attempts = 0;
    const maxAttempts = 20;  // 20 × 3s = 60s timeout
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
        {/* Comandos remotos (S1.1 + S1.2) */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>
            Comandos remotos
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <CommandButton
              tipo="sync_empleados"
              label="Sincronizar empleados"
              hint="Fuerza descarga de fotos y embeddings"
              state={cmdState.sync_empleados}
              onClick={() => sendCommand("sync_empleados")}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>}
            />
            <CommandButton
              tipo="limpiar_cache"
              label="Limpiar caché"
              hint="Borra cache de fotos y reconstruye"
              state={cmdState.limpiar_cache}
              onClick={() => sendCommand("limpiar_cache")}
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>}
            />
            <CommandButton
              tipo="reiniciar_app"
              label="Reiniciar aplicación"
              hint="Cierra y vuelve a abrir la station"
              state={cmdState.reiniciar_app}
              onClick={() => sendCommand("reiniciar_app")}
              variant="warning"
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
            />
          </div>
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
/* ── Metric chip (consistente con Tablero) ── */
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
  const [realtimeOk,     setRealtimeOk]     = useState(false);
  const [sucursales]                       = useState<Sucursal[]>(initialSucursales);
  
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("search");
      if (s) setSearchTerm(s);
    }
  }, []);

  const filteredDispositivos = searchTerm
    ? dispositivos.filter(d => 
        (d.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (d.sucursal_nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : dispositivos;

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
      <header className="tablero-hero" style={{ marginBottom: 18 }}>
        <div className="tablero-hero__title">
          <h1 className="heading-1" style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span>Estaciones</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", marginRight: 6 }}>·</span>
              {total} {total === 1 ? "estación" : "estaciones"}
            </span>
          </h1>
          <p className="text-muted-sm">Gestión y monitoreo de las estaciones de registro</p>
          {searchTerm && (
            <p style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <span>Filtrado por sucursal: <strong>"{searchTerm}"</strong></span>
              <button 
                onClick={() => {
                  setSearchTerm("");
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("search");
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
                className="btn btn-ghost btn-sm"
                style={{ height: 20, padding: "0 6px", fontSize: 10, borderRadius: 4, display: "inline-flex", alignItems: "center" }}
              >
                Limpiar filtro
              </button>
            </p>
          )}
        </div>
        <div className="tablero-hero__metrics">
          <MetricChip color="#22c55e" label="En línea"  value={online}  />
          <MetricChip color="#eab308" label="Sin señal" value={alerta}  />
          <MetricChip color="#ef4444" label="Offline"   value={offline} />
          <div className="tablero-hero__live">
            <StatusBadge
              kind={realtimeOk ? "live" : "offline"}
              label={realtimeOk ? "En vivo" : "Sin conexión"}
              strong={realtimeOk}
            />
          </div>
          <button
            onClick={() => setShowRegistrar(true)}
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 6 }}
          >
            <Plus size={13} strokeWidth={2.5} />
            Registrar estación
          </button>
        </div>
      </header>
      {/* Grid de cards */}
      {total > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 12 }}>
          {(() => {
            // Version de app mas alta vista en la flota -> referencia de "ultima".
            // Las que esten por debajo se marcan como pendientes de actualizar.
            const latestVersion = dispositivos.reduce<string | null>(
              (mx, d) => d.version_app && (!mx || semverCmp(d.version_app, mx) > 0) ? d.version_app : mx,
              null
            );
            return filteredDispositivos.map((d, i) => (
              <DispositivoCard
                key={d.id}
                d={d}
                onConfig={setSelected}
                onLogs={setLogsDevice}
                index={i}
                latestVersion={latestVersion}
              />
            ));
          })()}
        </div>
      ) : (
        <EmptyState onNew={() => setShowRegistrar(true)} />
      )}
    </div>
  );
}
