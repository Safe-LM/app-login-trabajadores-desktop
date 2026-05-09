"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Empresa  = { id: string; nombre: string };
type Sucursal = { id: string; empresa_id: string; nombre: string };

type ValidationResult =
  | { ok: true; token: string; hwid_short: string; expires_at: string }
  | { ok: false; error: string };

type Step = "validating" | "ready" | "activating" | "success" | "error";

export function ActivarClient({
  initialToken,
  empresas,
  sucursales,
}: {
  initialToken: string;
  empresas: Empresa[];
  sucursales: Sucursal[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [token, setToken] = useState(initialToken);
  const [step, setStep] = useState<Step>(initialToken ? "validating" : "ready");
  const [error, setError] = useState("");
  const [tokenInfo, setTokenInfo] = useState<{ hwid_short: string; expires_at: string } | null>(null);

  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [sucursalId, setSucursalId] = useState("");
  const [nombre, setNombre] = useState("");

  const sucursalesFiltradas = sucursales.filter(s => s.empresa_id === empresaId);

  useEffect(() => {
    if (sucursalesFiltradas.length > 0 && !sucursalId) {
      setSucursalId(sucursalesFiltradas[0].id);
    }
  }, [empresaId, sucursalesFiltradas, sucursalId]);

  // Validar token al cargar
  useEffect(() => {
    if (!initialToken) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: rpcErr } = await (supabase as any).rpc(
        "validar_token_provisioning",
        { p_token: initialToken }
      );
      if (rpcErr) {
        setError(rpcErr.message);
        setStep("error");
        return;
      }
      const result = data as ValidationResult;
      if (!result.ok) {
        setError(result.error);
        setStep("error");
        return;
      }
      setTokenInfo({ hwid_short: result.hwid_short, expires_at: result.expires_at });
      setStep("ready");
    })();
  }, [initialToken, supabase]);

  async function handleActivar(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !empresaId || !sucursalId || !nombre.trim()) {
      setError("Completa todos los campos");
      return;
    }

    setStep("activating");
    setError("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: rpcErr } = await (supabase as any).rpc(
      "activar_token_provisioning",
      {
        p_token:       token.toUpperCase(),
        p_empresa_id:  empresaId,
        p_sucursal_id: sucursalId,
        p_nombre:      nombre.trim(),
      }
    );

    if (rpcErr) {
      setError(rpcErr.message);
      setStep("error");
      return;
    }

    const result = data as { ok: boolean; error?: string; nombre?: string };
    if (!result?.ok) {
      setError(result?.error ?? "Error desconocido");
      setStep("error");
      return;
    }

    setStep("success");
  }

  return (
    <div style={containerStyle}>
      <div style={shellStyle}>
        <Header />

        {step === "validating" && <Validating />}

        {step === "ready" && (
          <ReadyForm
            token={token}
            setToken={setToken}
            tokenInfo={tokenInfo}
            empresas={empresas}
            empresaId={empresaId}
            setEmpresaId={setEmpresaId}
            sucursales={sucursalesFiltradas}
            sucursalId={sucursalId}
            setSucursalId={setSucursalId}
            nombre={nombre}
            setNombre={setNombre}
            error={error}
            onSubmit={handleActivar}
          />
        )}

        {step === "activating" && <Activating />}

        {step === "success" && (
          <Success
            nombre={nombre}
            sucursal={sucursalesFiltradas.find(s => s.id === sucursalId)?.nombre}
            onDone={() => router.push("/dispositivos")}
          />
        )}

        {step === "error" && (
          <ErrorState
            message={error}
            onRetry={() => {
              setError("");
              setStep("ready");
              setToken("");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function Header() {
  return (
    <div style={brandStyle}>
      <div style={brandIconStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span style={brandTextStyle}>SAFE<em style={{ color: "#3b82f6", fontStyle: "normal" }}>LINK</em></span>
      <span style={separatorStyle}>—</span>
      <span style={{ fontSize: 12, color: "#94a3b8", letterSpacing: "0.04em" }}>Activar estación</span>
    </div>
  );
}

function Validating() {
  return (
    <div style={centerStyle}>
      <div style={loaderStyle} />
      <h1 style={titleStyle}>Validando código…</h1>
      <p style={subtitleStyle}>Esto solo toma un momento.</p>
    </div>
  );
}

function ReadyForm({
  token, setToken, tokenInfo,
  empresas, empresaId, setEmpresaId,
  sucursales, sucursalId, setSucursalId,
  nombre, setNombre,
  error, onSubmit,
}: {
  token: string;
  setToken: (s: string) => void;
  tokenInfo: { hwid_short: string; expires_at: string } | null;
  empresas: Empresa[];
  empresaId: string;
  setEmpresaId: (s: string) => void;
  sucursales: Sucursal[];
  sucursalId: string;
  setSucursalId: (s: string) => void;
  nombre: string;
  setNombre: (s: string) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const expires = tokenInfo?.expires_at ? new Date(tokenInfo.expires_at) : null;
  const minutesLeft = expires ? Math.max(0, Math.round((expires.getTime() - Date.now()) / 60_000)) : null;

  return (
    <form onSubmit={onSubmit} style={{ width: "100%" }}>
      <h1 style={titleStyle}>Vincular esta estación</h1>
      <p style={subtitleStyle}>
        Selecciona la empresa y sucursal donde se instalará. La estación
        recibirá la activación inmediatamente.
      </p>

      {/* Token info */}
      {!tokenInfo && (
        <div style={{ ...fieldStyle, marginBottom: 18 }}>
          <label style={labelStyle}>Código de activación</label>
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value.toUpperCase())}
            placeholder="ABC-123-XYZ"
            maxLength={11}
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", fontSize: 16 }}
            required
          />
        </div>
      )}

      {tokenInfo && (
        <div style={tokenBadgeStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#4ade80", boxShadow: "0 0 8px #4ade80",
            }} />
            <div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Código verificado
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, letterSpacing: "0.1em", marginTop: 2 }}>
                {token}
              </div>
            </div>
          </div>
          {minutesLeft !== null && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              expira en {minutesLeft} min
            </span>
          )}
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Empresa</label>
        <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} style={inputStyle} required>
          {empresas.length === 0 && <option value="">— sin empresas —</option>}
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Sucursal</label>
        <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} style={inputStyle} required>
          {sucursales.length === 0 && <option value="">— sin sucursales para esta empresa —</option>}
          {sucursales.map(suc => (
            <option key={suc.id} value={suc.id}>{suc.nombre}</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Nombre de la estación</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Recepción Principal"
          style={inputStyle}
          maxLength={64}
          required
        />
      </div>

      {error && (
        <div style={errorBoxStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <button type="submit" style={primaryBtnStyle} disabled={!empresaId || !sucursalId || !nombre.trim() || !token}>
        Activar estación
      </button>
    </form>
  );
}

function Activating() {
  return (
    <div style={centerStyle}>
      <div style={loaderStyle} />
      <h1 style={titleStyle}>Activando…</h1>
      <p style={subtitleStyle}>Vinculando estación a tu empresa y emitiendo credenciales.</p>
    </div>
  );
}

function Success({ nombre, sucursal, onDone }: { nombre: string; sucursal?: string; onDone: () => void }) {
  return (
    <div style={centerStyle}>
      <div style={successIconStyle}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h1 style={titleStyle}>Estación activada</h1>
      <p style={subtitleStyle}>
        <strong style={{ color: "#f1f5f9" }}>{nombre}</strong>
        {sucursal && <> • {sucursal}</>}
        <br />
        La estación recibirá la activación en segundos.
      </p>
      <button onClick={onDone} style={{ ...primaryBtnStyle, marginTop: 28 }}>
        Ver mis estaciones
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={centerStyle}>
      <div style={{ ...successIconStyle, background: "linear-gradient(135deg, #ef4444, #b91c1c)", boxShadow: "0 0 36px rgba(239,68,68,0.4)" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <h1 style={titleStyle}>No se pudo activar</h1>
      <p style={{ ...subtitleStyle, color: "#fca5a5" }}>{message}</p>
      <button onClick={onRetry} style={{ ...secondaryBtnStyle, marginTop: 24 }}>
        Intentar con otro código
      </button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(59,130,246,0.06), transparent 65%), #050810",
};

const shellStyle: React.CSSProperties = {
  width: "min(480px, 100%)",
  padding: "40px 36px",
  background: "linear-gradient(180deg, rgba(13,18,32,0.85) 0%, rgba(10,15,28,0.95) 100%)",
  border: "1px solid rgba(148,163,184,0.08)",
  borderRadius: 20,
  backdropFilter: "blur(20px)",
  boxShadow: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 64px -16px rgba(0,0,0,0.5)",
};

const brandStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  marginBottom: 28,
};

const brandIconStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8,
  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 0 20px rgba(59,130,246,0.3)",
};

const brandTextStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", color: "#f1f5f9",
};

const separatorStyle: React.CSSProperties = {
  color: "#475569", margin: "0 4px",
};

const titleStyle: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
  marginBottom: 6, color: "#f1f5f9",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13, color: "#94a3b8",
  marginBottom: 24, lineHeight: 1.5,
};

const centerStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column",
  alignItems: "center", textAlign: "center",
  padding: "10px 0",
};

const loaderStyle: React.CSSProperties = {
  width: 36, height: 36, marginBottom: 24,
  border: "2px solid rgba(59,130,246,0.15)",
  borderTopColor: "#3b82f6",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const successIconStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: "50%",
  background: "linear-gradient(135deg, #22c55e, #16a34a)",
  display: "flex", alignItems: "center", justifyContent: "center",
  marginBottom: 24,
  boxShadow: "0 0 36px rgba(34,197,94,0.4)",
  animation: "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
};

const fieldStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
  color: "#64748b", textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 10,
  fontSize: 13, color: "#f1f5f9",
  outline: "none",
  colorScheme: "dark",
  transition: "all 0.2s",
};

const tokenBadgeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px",
  background: "rgba(34,197,94,0.06)",
  border: "1px solid rgba(34,197,94,0.18)",
  borderRadius: 10,
  marginBottom: 24,
};

const errorBoxStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "10px 14px",
  background: "rgba(239,68,68,0.08)",
  border: "1px solid rgba(239,68,68,0.2)",
  borderRadius: 10,
  fontSize: 12, color: "#fca5a5",
  marginBottom: 16,
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  border: "none",
  borderRadius: 10,
  fontSize: 13, fontWeight: 600, color: "#fff",
  cursor: "pointer",
  letterSpacing: "0.02em",
  boxShadow: "0 8px 24px -8px rgba(59,130,246,0.5)",
  transition: "all 0.2s",
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "rgba(148,163,184,0.08)",
  border: "1px solid rgba(148,163,184,0.16)",
  boxShadow: "none",
  color: "#f1f5f9",
};
