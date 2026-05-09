"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FieldLabel, btnGhost, inputStyle, type Sucursal } from "./_shared";

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

type ResultState = {
  mode: "zero-touch" | "manual";
  nombre: string;
  api_key?: string;
};

export default function RegistrarEstacionModal({ onClose, onDone, sucursales }: {
  onClose: () => void;
  onDone: () => void;
  sucursales: Sucursal[];
}) {
  const [nombre,     setNombre]     = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [hwid,       setHwid]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState<ResultState | null>(null);
  const [copied,     setCopied]     = useState(false);

  const hwidClean = hwid.trim().toUpperCase();
  const isZeroTouch = hwidClean.length >= 8;

  async function handleSubmit() {
    if (!nombre.trim()) { setError("Escribe un nombre para la estación."); return; }
    setError(""); setLoading(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (isZeroTouch) {
        const { data, error: rpcErr } = await supabase.rpc("vincular_estacion_hwid", {
          p_user_id:     userId ?? "",
          p_hwid:        hwidClean,
          p_nombre:      nombre.trim(),
          p_sucursal_id: sucursalId || null,
        });
        if (rpcErr) throw rpcErr;
        if (!data?.ok) throw new Error(data?.error ?? "Error al activar");
        setResult({ mode: "zero-touch", nombre: nombre.trim() });
      } else {
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

  return (
    <Modal onClose={onClose} maxWidth={460}>
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
        <button onClick={onClose} style={btnGhost} aria-label="Cerrar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {!result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

          {sucursales.length > 0 && (
            <div>
              <FieldLabel>Sucursal <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(opcional)</span></FieldLabel>
              <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">— Sin sucursal —</option>
                {sucursales.map(s => <option key={s.id} value={s.id} style={{ background: "#0f0f10" }}>{s.nombre}</option>)}
              </select>
            </div>
          )}

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

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
