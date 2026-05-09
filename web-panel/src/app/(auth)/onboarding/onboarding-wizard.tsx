"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* ── Design tokens — consistente con globals.css ── */
const C = {
  bg:         "var(--bg-black)",
  card:       "var(--bg-card)",
  elevated:   "var(--bg-elevated)",
  border:     "var(--border)",
  accent:     "var(--accent)",
  accentGlow: "var(--accent-glow)",
  text:       "var(--text-primary)",
  muted:      "var(--text-muted)",
  faint:      "var(--text-faint)",
  green:      "var(--green)",
};

const STEPS = [
  { id: 1, label: "Tu cuenta",  desc: "Datos del administrador"  },
  { id: 2, label: "Empresa",    desc: "Información de tu empresa" },
  { id: 3, label: "Sucursal",   desc: "Primera ubicación"        },
  { id: 4, label: "Listo",      desc: "Todo configurado"         },
];

const TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Sao_Paulo",
];

/* ── Stepper ── */
function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {STEPS.map((s, i) => {
        const done    = s.id < current;
        const active  = s.id === current;
        const pending = s.id > current;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            {/* Circulo */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: done ? "var(--green)" : active ? "var(--accent)" : "var(--bg-elevated)",
                border: done ? "none" : active ? "2px solid var(--accent)" : "1px solid var(--border)",
                color: done || active ? "#fff" : "var(--text-faint)",
                boxShadow: active ? "0 0 16px var(--accent-glow)" : "none",
                transition: "all 300ms ease",
              }}>
                {done ? <CheckSVG /> : s.id}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 600 : 400,
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                whiteSpace: "nowrap", letterSpacing: "0.04em",
              }}>
                {s.label}
              </span>
            </div>
            {/* Linea conectora */}
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1, marginBottom: 22, marginLeft: 8, marginRight: 8,
                background: done ? "var(--green)" : "var(--border)",
                transition: "background 400ms ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Input field ── */
function Field({
  label, value, onChange, placeholder, type = "text", required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 500, color: "var(--text-muted)",
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        {label}{required && <span style={{ color: "var(--accent)", marginLeft: 3 }}>*</span>}
      </label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "11px 14px",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: 10, fontSize: 13, color: "var(--text-primary)",
          outline: "none", transition: "border-color 150ms, box-shadow 150ms",
          fontFamily: "inherit", boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(37,99,235,0.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow   = "none";
        }}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 500, color: "var(--text-muted)",
        letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        {label}
      </label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "11px 14px",
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: 10, fontSize: 13, color: "var(--text-primary)",
          outline: "none", cursor: "pointer", fontFamily: "inherit",
          transition: "border-color 150ms",
        }}
        onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
        onBlur={(e)  => e.currentTarget.style.borderColor = "var(--border)"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}
            style={{ background: "#0f172a", color: "var(--text-primary)" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Boton principal ── */
function PrimaryBtn({
  children, onClick, loading = false, disabled = false, fullWidth = true,
}: {
  children: React.ReactNode; onClick?: () => void;
  loading?: boolean; disabled?: boolean; fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={loading || disabled}
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: "13px 24px", marginTop: 8,
        background: loading || disabled ? "rgba(37,99,235,0.4)" : "var(--accent)",
        color: "#fff", border: "none", borderRadius: 10,
        fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "background 200ms, box-shadow 200ms",
        boxShadow: loading || disabled ? "none" : "0 0 20px var(--accent-glow)",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { if (!loading && !disabled) e.currentTarget.style.background = "var(--accent-hover)"; }}
      onMouseLeave={(e) => { if (!loading && !disabled) e.currentTarget.style.background = "var(--accent)"; }}
    >
      {loading && <SpinnerSVG />}
      {children}
    </button>
  );
}

/* ── Error banner ── */
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 10, padding: "10px 14px", marginBottom: 16,
    }}>
      <AlertSVG />
      <span style={{ fontSize: 12, color: "#f87171" }}>{msg}</span>
    </div>
  );
}

/* ── Step 1: Info de cuenta (solo lectura, ya autenticado) ── */
function Step1({ email, onNext }: { email: string; onNext: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Bienvenido a Safe Link
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Tu cuenta ha sido creada exitosamente. Ahora configuremos tu empresa para empezar.
        </p>
      </div>

      {/* Card de cuenta */}
      <div style={{
        background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)",
        borderRadius: 12, padding: "16px 18px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: "var(--accent)", flexShrink: 0,
        }}>
          {email[0].toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{email}</p>
          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>Administrador — cuenta verificada</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} className="animate-pulse-dot" />
            <span style={{ fontSize: 11, color: "var(--green)" }}>Activa</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          "Configura tu empresa en el siguiente paso",
          "Agrega tu primera sucursal",
          "Registra estaciones fisicas desde el panel",
        ].map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>{i + 1}</span>
            </div>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t}</span>
          </div>
        ))}
      </div>

      <PrimaryBtn onClick={onNext}>
        Continuar
        <ArrowSVG />
      </PrimaryBtn>
    </div>
  );
}

/* ── Step 2: Datos de empresa ── */
function Step2({
  onNext, onBack,
}: {
  onNext: (data: { nombre: string; timezone: string }) => void;
  onBack: () => void;
}) {
  const [nombre,   setNombre]   = useState("");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [error,    setError]    = useState("");

  function handleNext() {
    if (!nombre.trim()) { setError("El nombre de la empresa es requerido."); return; }
    setError("");
    onNext({ nombre: nombre.trim(), timezone });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Tu empresa
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Esta informacion aparecera en reportes y en la app de estaciones.
        </p>
      </div>

      {error && <ErrorBanner msg={error} />}

      <Field label="Nombre de la empresa" value={nombre} onChange={setNombre}
        placeholder="Ej: Distribuidora Morales SA" required />

      <SelectField
        label="Zona horaria"
        value={timezone}
        onChange={setTimezone}
        options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace("_", " ") }))}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <PrimaryBtn onClick={handleNext}>
          Continuar
          <ArrowSVG />
        </PrimaryBtn>
        <button onClick={onBack} style={{
          padding: "10px", background: "none",
          border: "1px solid var(--border)", borderRadius: 10,
          fontSize: 13, color: "var(--text-muted)", cursor: "pointer",
          fontFamily: "inherit", transition: "border-color 150ms",
        }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-hover, #334155)"}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
        >
          Atras
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Primera sucursal ── */
function Step3({
  onNext, onBack, loading,
}: {
  onNext: (data: { nombre: string; ciudad: string }) => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [nombre, setNombre] = useState("Oficina Principal");
  const [ciudad, setCiudad] = useState("");
  const [error,  setError]  = useState("");

  function handleNext() {
    if (!nombre.trim()) { setError("El nombre de la sucursal es requerido."); return; }
    setError("");
    onNext({ nombre: nombre.trim(), ciudad: ciudad.trim() });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>
          Primera sucursal
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Puedes agregar mas sucursales despues desde el panel de configuracion.
        </p>
      </div>

      {error && <ErrorBanner msg={error} />}

      <Field label="Nombre de la sucursal" value={nombre} onChange={setNombre}
        placeholder="Ej: Oficina Principal, Almacen Central" required />

      <Field label="Ciudad (opcional)" value={ciudad} onChange={setCiudad}
        placeholder="Ej: Monterrey, CDMX" />

      {/* Info card */}
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 14px",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <InfoSVG />
        <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6 }}>
          Cada sucursal puede tener sus propias estaciones de reconocimiento facial y empleados asignados.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <PrimaryBtn onClick={handleNext} loading={loading}>
          {loading ? "Creando empresa..." : "Finalizar configuracion"}
        </PrimaryBtn>
        <button onClick={onBack} disabled={loading} style={{
          padding: "10px", background: "none",
          border: "1px solid var(--border)", borderRadius: 10,
          fontSize: 13, color: "var(--text-muted)", cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}>
          Atras
        </button>
      </div>
    </div>
  );
}

/* ── Step 4: Exito ── */
function Step4({ empresa, sucursal, onGo }: {
  empresa: string; sucursal: string; onGo: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", textAlign: "center" }}>
      {/* Check animado */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 30px rgba(34,197,94,0.2)",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>
          Todo listo
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Tu empresa ha sido configurada exitosamente.<br />
          Ya puedes empezar a usar Safe Link Monitoring.
        </p>
      </div>

      {/* Resumen */}
      <div style={{
        width: "100%", background: "var(--bg-elevated)",
        border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 10, textAlign: "left",
      }}>
        {[
          { label: "Empresa",   value: empresa  },
          { label: "Sucursal",  value: sucursal },
          { label: "Plan",      value: "Starter — hasta 50 empleados" },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={onGo} style={{
          width: "100%", padding: "13px 24px",
          background: "var(--green)", color: "#fff",
          border: "none", borderRadius: 10,
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 0 20px rgba(34,197,94,0.25)",
          fontFamily: "inherit", transition: "background 200ms",
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#16a34a"}
          onMouseLeave={(e) => e.currentTarget.style.background = "var(--green)"}
        >
          Ir al dashboard
          <ArrowSVG />
        </button>
      </div>
    </div>
  );
}

/* ── Wizard principal ── */
export function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [empresa,  setEmpresa]  = useState({ nombre: "", timezone: "America/Mexico_City" });
  const [sucursal, setSucursal] = useState({ nombre: "", ciudad: "" });

  async function handleFinish(suc: { nombre: string; ciudad: string }) {
    setSucursal(suc);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, sucursal: suc }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al crear empresa"); setLoading(false); return; }
      setStep(4);
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-black)", padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      {/* Glow de fondo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%)",
      }} />

      <div style={{ width: "100%", maxWidth: 520, position: "relative" }} className="animate-fade-up">

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px var(--accent-glow)",
          }}>
            <ShieldSVG />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Safe Link Monitoring
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "36px 36px 32px",
          boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 80px rgba(37,99,235,0.05)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Franja accent superior */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, transparent 0%, #2563eb 30%, #60a5fa 70%, transparent 100%)",
            borderRadius: "16px 16px 0 0",
          }} />

          {step < 4 && <Stepper current={step} />}

          {error && step < 4 && <ErrorBanner msg={error} />}

          {step === 1 && (
            <Step1 email={userEmail} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2
              onNext={(data) => { setEmpresa(data); setStep(3); }}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3
              onNext={handleFinish}
              onBack={() => setStep(2)}
              loading={loading}
            />
          )}
          {step === 4 && (
            <Step4
              empresa={empresa.nombre}
              sucursal={sucursal.nombre}
              onGo={() => { router.refresh(); router.push("/dashboard"); }}
            />
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "var(--text-faint)" }}>
          Safe Link Monitoring — Configuracion inicial · Paso {step} de {STEPS.length}
        </p>
      </div>
    </div>
  );
}

/* ── SVG Icons ── */
function ShieldSVG() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function CheckSVG() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function ArrowSVG() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;
}
function AlertSVG() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function InfoSVG() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}
function SpinnerSVG() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin-slow"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>;
}
