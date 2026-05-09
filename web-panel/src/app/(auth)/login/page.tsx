"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login")) {
          setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          setError("Confirma tu correo electrónico antes de ingresar.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } catch (err: any) {
      const msg = String(err);
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("Sin conexión al servidor. Verifica tu internet o contacta soporte.");
      } else {
        setError("Error inesperado. Intenta de nuevo.");
      }
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg-black)" }}>
      <div style={{
        width: "480px", flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "48px",
        borderRight: "1px solid var(--border)", position: "relative", overflow: "hidden",
      }} className="hidden lg:flex">
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 50% at 15% 85%, rgba(37,99,235,0.12) 0%, transparent 65%)",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px var(--accent-glow)",
          }}>
            <ShieldIcon size={18} />
          </div>
          <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>
            Safe Link Monitoring
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 500, marginBottom: 16 }}>
            Plataforma SaaS B2B
          </p>
          <h2 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 16 }}>
            Control biometrico de asistencia
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 320, marginBottom: 40 }}>
            Gestiona empleados, estaciones y reportes de todas tus sucursales desde un solo lugar.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Reconocimiento facial con IA local", "Multi-empresa con aislamiento total", "Sincronizacion en tiempo real"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: "1px solid rgba(37,99,235,0.4)", background: "rgba(37,99,235,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}><CheckIcon /></div>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-faint)", position: "relative" }}>
          2025 Safe Link Monitoring
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 360 }} className="animate-fade-up">
          <div className="lg:hidden" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldIcon size={16} />
            </div>
            <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>Safe Link Monitoring</span>
          </div>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 6 }}>
              Bienvenido
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Ingresa tus credenciales para continuar</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Correo electronico">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required placeholder="admin@empresa.com" style={inputStyle}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
            </Field>
            <Field label="Contrasena">
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required placeholder="..." style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-faint)", display: "flex", alignItems: "center", transition: "color 150ms",
                }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-faint)"}>
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, padding: "10px 14px",
              }}>
                <AlertIcon />
                <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: "12px 20px",
              background: loading ? "rgba(37,99,235,0.5)" : "var(--accent)",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 200ms, box-shadow 200ms",
              boxShadow: loading ? "none" : "0 0 20px var(--accent-glow)", fontFamily: "inherit",
            }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}>
              {loading && <SpinnerIcon />}
              {loading ? "Verificando..." : "Ingresar al panel"}
            </button>
          </form>
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} className="animate-pulse-dot" />
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Sistema operativo v3.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 10, fontSize: 13, color: "var(--text-primary)",
  outline: "none", transition: "border-color 150ms", fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function ShieldIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function CheckIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function EyeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
function AlertIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>;
}
