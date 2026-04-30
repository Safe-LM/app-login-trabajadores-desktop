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
};
type Sucursal = { id: string; nombre: string };

const ESTADO = {
  online:  { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  label: "En linea"        },
  alerta:  { color: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)",  label: "Sin senal"       },
  offline: { color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  label: "Offline"         },
  nunca:   { color: "#52525b", bg: "rgba(63,63,70,0.4)",    border: "rgba(63,63,70,0.6)",   label: "Nunca conectado" },
};

function fmt(secs: number | null) {
  if (secs == null) return "—";
  if (secs < 60)   return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
  return `hace ${Math.floor(secs / 3600)}h`;
}

/* ── API Key con copiar ── */
function ApiKey({ apiKey }: { apiKey: string }) {
  const [vis, setVis]       = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = `${apiKey.slice(0, 10)}${"•".repeat(18)}`;

  function copy() {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <code style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace" }}>
        {vis ? apiKey : masked}
      </code>
      <button onClick={() => setVis(!vis)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 11, padding: 0 }}>
        {vis ? "ocultar" : "ver"}
      </button>
      <button onClick={copy} title="Copiar" style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22c55e" : "var(--text-faint)", padding: 0, display: "flex" }}>
        {copied
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        }
      </button>
    </div>
  );
}

/* ── Modal crear estacion ── */
function CrearModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre,      setNombre]      = useState("");
  const [sucursalId,  setSucursalId]  = useState("");
  const [sucursales,  setSucursales]  = useState<Sucursal[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<{ id: string; api_key: string; nombre: string } | null>(null);
  const [copied,      setCopied]      = useState(false);

  useEffect(() => {
    fetch("/api/sucursales")
      .then((r) => r.json())
      .then((d) => setSucursales(d.sucursales ?? []));
  }, []);

  async function handleCreate() {
    if (!nombre.trim()) { setError("Escribe un nombre para la estacion."); return; }
    setError(""); setLoading(true);
    const res = await fetch("/api/dispositivos/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), sucursal_id: sucursalId || null }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Error al crear"); return; }
    setResult(data.dispositivo);
  }

  function copyKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28, width: "100%", maxWidth: 460,
        position: "relative", overflow: "hidden",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Franja accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, transparent, #2563eb 30%, #60a5fa 70%, transparent)",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "rgba(37,99,235,0.12)",
              border: "1px solid rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {result ? "Estacion creada" : "Nueva estacion"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!result ? (
          /* ── Formulario ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Nombre de la estacion <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Entrada Principal, Almacen, Recepcion"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                style={{
                  padding: "11px 14px", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: 10,
                  fontSize: 13, color: "var(--text-primary)", outline: "none",
                  fontFamily: "inherit", transition: "border-color 150ms, box-shadow 150ms",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                autoFocus
              />
            </div>

            {sucursales.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Sucursal (opcional)
                </label>
                <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{
                  padding: "11px 14px", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: 10,
                  fontSize: 13, color: "var(--text-primary)", outline: "none",
                  fontFamily: "inherit", cursor: "pointer",
                }}>
                  <option value="">-- Sin sucursal --</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id} style={{ background: "#0f172a" }}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
              </div>
            )}

            <button onClick={handleCreate} disabled={loading} style={{
              marginTop: 4, padding: "12px 20px",
              background: loading ? "rgba(37,99,235,0.5)" : "var(--accent)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "inherit", transition: "background 200ms",
              boxShadow: loading ? "none" : "0 0 20px var(--accent-glow)",
            }}>
              {loading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>}
              {loading ? "Creando..." : "Crear estacion"}
            </button>
          </div>
        ) : (
          /* ── Resultado: API Key ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Check */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#4ade80" }}>Estacion creada</p>
                <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{result.nombre}</p>
              </div>
            </div>

            {/* Instruccion */}
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.6 }}>
                Copia esta API Key y agregala al archivo <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>.env</code> de la maquina fisica:
              </p>
              {/* Key box */}
              <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Agrega esto en .env
                </p>
                <code style={{ fontSize: 12, color: "#4ade80", fontFamily: "monospace", wordBreak: "break-all" }}>
                  STATION_API_KEY={result.api_key}
                </code>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={copyKey} style={{
                padding: "11px 20px", borderRadius: 10,
                background: copied ? "rgba(34,197,94,0.15)" : "var(--bg-elevated)",
                border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                color: copied ? "#4ade80" : "var(--text-primary)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit", transition: "all 200ms",
              }}>
                {copied
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar STATION_API_KEY</>
                }
              </button>
              <button onClick={() => { onCreated(); onClose(); }} style={{
                padding: "11px 20px", background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 0 16px var(--accent-glow)",
              }}>
                Listo, ver estaciones
              </button>
            </div>

            <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
              Guarda la API Key ahora — no se volvera a mostrar completa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Card de dispositivo ── */
function DispositivoCard({ d, onConfig }: { d: Dispositivo; onConfig: (d: Dispositivo) => void }) {
  const meta = ESTADO[d.estado_conexion];
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{d.nombre}</p>
            <p style={{ fontSize: 11, color: "var(--text-faint)" }}>{d.sucursal_nombre ?? "Sin sucursal"}</p>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, borderRadius: 6, padding: "3px 8px", background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: meta.color, display: "inline-block" }} />
          {meta.label}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
        {[["IP", d.ip_local ?? "—"], ["Host", d.hostname ?? "—"], ["Version", d.version_app ? `v${d.version_app}` : "—"], ["Ping", fmt(d.segundos_desde_heartbeat)]].map(([k, v]) => (
          <div key={k}>
            <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>{k}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{v}</p>
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>API Key</p>
        <ApiKey apiKey={d.api_key} />
      </div>

      <button onClick={() => onConfig(d)} style={{
        padding: "8px 12px", background: "var(--bg-elevated)",
        border: "1px solid var(--border)", borderRadius: 8,
        fontSize: 12, fontWeight: 500, color: "var(--text-muted)", cursor: "pointer",
        fontFamily: "inherit", transition: "border-color 150ms, color 150ms",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)";  e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        Configurar
      </button>
    </div>
  );
}

/* ── Modal configurar ── */
function ConfigModal({ d, onClose }: { d: Dispositivo; onClose: () => void }) {
  const [nombre,  setNombre]  = useState(d.nombre);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/dispositivos/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, nombre }) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(onClose, 800); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440, position: "relative", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #2563eb 30%, #60a5fa 70%, transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Configurar estacion</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
          </div>
          <div style={{ padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>ID del dispositivo</p>
            <code style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>{d.id}</code>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>Linea para .env de la estacion</p>
            <code style={{ fontSize: 11, color: "#4ade80", fontFamily: "monospace", wordBreak: "break-all" }}>STATION_API_KEY={d.api_key}</code>
          </div>
          <button onClick={save} disabled={saving || saved} style={{
            padding: "10px 20px", background: saved ? "rgba(34,197,94,0.2)" : "var(--accent)",
            color: saved ? "#4ade80" : "#fff", border: saved ? "1px solid rgba(34,197,94,0.3)" : "none",
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
          }}>
            {saved ? "Guardado" : saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function DispositivosClient({ dispositivos: initial }: { dispositivos: Dispositivo[] }) {
  const router                          = useRouter();
  const [dispositivos,  setDispositivos] = useState(initial);
  const [showCrear,     setShowCrear]   = useState(false);
  const [selected,      setSelected]    = useState<Dispositivo | null>(null);
  const [realtimeOk,    setRealtimeOk]  = useState(false);

  const online  = dispositivos.filter((d) => d.estado_conexion === "online").length;
  const alerta  = dispositivos.filter((d) => d.estado_conexion === "alerta").length;
  const offline = dispositivos.filter((d) => ["offline","nunca"].includes(d.estado_conexion)).length;

  // Sync local state when server re-renders with fresh data after router.refresh()
  useEffect(() => { setDispositivos(initial); }, [initial]);

  const refresh = useCallback(() => router.refresh(), [router]);

  // Supabase Realtime — re-fetch server data on any change to dispositivos
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dispositivos-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "dispositivos" }, () => {
        router.refresh();
      })
      .subscribe((status) => {
        setRealtimeOk(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
      {showCrear && <CrearModal onClose={() => setShowCrear(false)} onCreated={refresh} />}
      {selected  && <ConfigModal d={selected} onClose={() => { setSelected(null); refresh(); }} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Estaciones</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Monitoreo en tiempo real</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: realtimeOk ? "var(--green)" : "#52525b", transition: "background 400ms" }} className={realtimeOk ? "animate-pulse-dot" : undefined} />
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{realtimeOk ? "Tiempo real" : "Conectando..."}</span>
          </div>
          <button onClick={() => setShowCrear(true)} style={{
            padding: "8px 16px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", boxShadow: "0 0 14px var(--accent-glow)",
            transition: "background 200ms",
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva estacion
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "En linea",  value: online,  color: "#22c55e", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.15)"  },
          { label: "Sin senal", value: alerta,  color: "#eab308", bg: "rgba(234,179,8,0.06)",  border: "rgba(234,179,8,0.15)"  },
          { label: "Offline",   value: offline, color: "#ef4444", bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.15)"  },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ fontSize: 11, color: s.color, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {dispositivos.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 12 }}>
          {dispositivos.map((d) => <DispositivoCard key={d.id} d={d} onConfig={setSelected} />)}
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "64px 20px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Sin estaciones registradas</p>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 20 }}>
            Crea tu primera estacion y copia la API Key al .env de la maquina fisica.
          </p>
          <button onClick={() => setShowCrear(true)} style={{
            padding: "10px 20px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 14px var(--accent-glow)",
          }}>
            Crear primera estacion
          </button>
        </div>
      )}
    </div>
  );
}
