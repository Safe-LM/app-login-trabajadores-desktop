"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Eye, Mail, AlertCircle, ArrowRight, LogOut, User as UserIcon, Lock, Eye as EyeOpen, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type PreviewOk = {
  ok: true;
  email: string;
  rol: "admin" | "viewer";
  empresa_id: string;
  empresa_nombre: string;
  expira_en: string;
};
type PreviewErr = { ok: false; error: string };
type Preview = PreviewOk | PreviewErr | null;

type Props = {
  token: string;
  preview: Preview;
  userEmail: string | null;
  isAuthenticated: boolean;
  needsAccountSetup: boolean;
};

const ROL_META = {
  admin:  { label: "Admin",  desc: "Podrás gestionar estaciones, empleados y sucursales.", icon: Shield, color: "#2563eb" },
  viewer: { label: "Viewer", desc: "Tendrás acceso de solo lectura a reportes y dashboards.", icon: Eye, color: "#64748b" },
};

export function InvitacionClient({ token, preview, userEmail, isAuthenticated, needsAccountSetup }: Props) {
  // Estado del paso actual: si el invitado es nuevo y autenticado, mostramos
  // primero el setup de cuenta (nombre + password), luego la aceptacion.
  const [accountReady, setAccountReady] = useState(!needsAccountSetup);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-black, #070710)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "var(--bg-card, #101828)",
        border: "1px solid var(--border, rgba(255,255,255,.08))",
        borderRadius: 16,
        boxShadow: "0 24px 48px rgba(0,0,0,.4)",
        overflow: "hidden",
      }}>
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, transparent, #2563eb 30%, #60a5fa 70%, transparent)",
        }} />

        <div style={{ padding: 32 }}>
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 28px rgba(37,99,235,.4)",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
          </div>

          {!preview ? (
            <ErrorState message="No pudimos cargar la invitación. Intenta de nuevo." />
          ) : !preview.ok ? (
            <ErrorState message={preview.error} />
          ) : !accountReady ? (
            <AccountSetup
              email={preview.email}
              empresaNombre={preview.empresa_nombre}
              onDone={() => setAccountReady(true)}
            />
          ) : (
            <ValidPreview
              preview={preview}
              token={token}
              userEmail={userEmail}
              isAuthenticated={isAuthenticated}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <AlertCircle size={24} color="#ef4444" />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary, #f1f5f9)", marginBottom: 8 }}>
        Invitación no válida
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted, #94a3b8)", marginBottom: 24, lineHeight: 1.6 }}>
        {message}
      </p>
      <Link href="/login" style={{
        display: "inline-block", padding: "10px 20px",
        background: "transparent", border: "1px solid var(--border)",
        borderRadius: 10, color: "var(--text-primary, #f1f5f9)",
        fontSize: 13, fontWeight: 600, textDecoration: "none",
      }}>
        Ir al panel
      </Link>
    </div>
  );
}

/* ─────────── AccountSetup — primer paso para invitados nuevos ─────────── */
function AccountSetup({
  email, empresaNombre, onDone,
}: {
  email: string;
  empresaNombre: string;
  onDone: () => void;
}) {
  const [nombre, setNombre]         = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [touched, setTouched]       = useState(false);

  const nombreTrim = nombre.trim();
  const nombreOk   = nombreTrim.length >= 2;
  const passwordOk = password.length >= 8;
  const canSubmit  = !saving && nombreOk && passwordOk;

  async function submit() {
    if (!canSubmit) { setTouched(true); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
        data: { full_name: nombreTrim },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Cuenta configurada");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 800,
          color: "var(--text-primary, #f1f5f9)",
          marginBottom: 6, letterSpacing: "-.02em",
        }}>
          Completa tu cuenta
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--text-muted, #94a3b8)", lineHeight: 1.55 }}>
          Configura tu nombre y contraseña para unirte a <b style={{ color: "var(--text-primary)" }}>{empresaNombre}</b>.
        </p>
      </div>

      {/* Email read-only chip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px", borderRadius: 9,
        background: "rgba(59,130,246,.06)",
        border: "1px solid rgba(59,130,246,.18)",
        marginBottom: 18,
      }}>
        <Mail size={13} color="#60a5fa" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Tu correo:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email}
        </span>
      </div>

      {/* Nombre */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: "block", fontSize: 10, fontWeight: 700,
          color: "var(--text-muted)", marginBottom: 5,
          textTransform: "uppercase", letterSpacing: ".08em",
        }}>
          Tu nombre completo
        </label>
        <div style={{ position: "relative" }}>
          <UserIcon
            size={13}
            style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              color: nombreOk ? "#3b82f6" : "var(--text-faint, #475569)",
              pointerEvents: "none", transition: "color .15s",
            }}
          />
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Ej. Juan Pérez"
            autoFocus
            autoComplete="name"
            className="input"
            style={{
              width: "100%", paddingLeft: 32,
              borderColor: touched && !nombreOk ? "rgba(239,68,68,.4)" : undefined,
            }}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
        </div>
      </div>

      {/* Password */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: "block", fontSize: 10, fontWeight: 700,
          color: "var(--text-muted)", marginBottom: 5,
          textTransform: "uppercase", letterSpacing: ".08em",
        }}>
          Crea una contraseña
        </label>
        <div style={{ position: "relative" }}>
          <Lock
            size={13}
            style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              color: passwordOk ? "#3b82f6" : "var(--text-faint, #475569)",
              pointerEvents: "none", transition: "color .15s",
            }}
          />
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className="input"
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 36,
              borderColor: touched && !passwordOk ? "rgba(239,68,68,.4)" : undefined,
            }}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            tabIndex={-1}
            aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 24, height: 24, borderRadius: 6,
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-faint, #475569)",
            }}
          >
            {showPw ? <EyeOff size={13} /> : <EyeOpen size={13} />}
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: "var(--text-faint, #475569)", margin: "6px 0 0" }}>
          Usa al menos 8 caracteres. La podrás cambiar después en tu perfil.
        </p>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "13px 20px",
          background: canSubmit
            ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
            : "rgba(37,99,235,.25)",
          border: "none", borderRadius: 11,
          color: "#fff", fontSize: 13.5, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          boxShadow: canSubmit ? "0 4px 18px rgba(37,99,235,.35)" : "none",
          transition: "all .15s",
        }}
      >
        {saving ? (
          <>
            <span style={{
              width: 13, height: 13, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.35)",
              borderTopColor: "#fff",
              animation: "spin .7s linear infinite",
            }} />
            <span>Guardando…</span>
          </>
        ) : (
          <>
            <span>Continuar</span>
            <ArrowRight size={14} />
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

function ValidPreview({
  preview, token, userEmail, isAuthenticated,
}: {
  preview: PreviewOk;
  token: string;
  userEmail: string | null;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const rolMeta = ROL_META[preview.rol];
  const RolIcon = rolMeta.icon;

  const emailMatches = userEmail === preview.email;
  const emailMismatch = isAuthenticated && !emailMatches;

  async function aceptar() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invitaciones/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "No se pudo aceptar");
        return;
      }
      toast.success(`¡Bienvenido a ${preview.empresa_nombre}!`);
      // Redirigir al dashboard. Forzamos refresh para que metadata se aplique.
      router.refresh();
      window.location.href = "/tablero";
    } finally {
      setAccepting(false);
    }
  }

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/login?next=/invitacion/${token}`;
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #f1f5f9)", marginBottom: 6, letterSpacing: "-.02em" }}>
          Te invitaron a {preview.empresa_nombre}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted, #94a3b8)" }}>
          Estás a un paso de unirte al equipo.
        </p>
      </div>

      {/* Card con detalles */}
      <div style={{
        background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.2)",
        borderRadius: 12, padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Mail size={14} color="#94a3b8" />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Email invitado:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            {preview.email}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RolIcon size={14} color={rolMeta.color} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Rol asignado:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: rolMeta.color }}>
            {rolMeta.label}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-faint, #64748b)", marginTop: 10, lineHeight: 1.6 }}>
          {rolMeta.desc}
        </p>
      </div>

      {/* Acción según estado */}
      {!isAuthenticated ? (
        <>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, textAlign: "center" }}>
            Inicia sesión con <b>{preview.email}</b> para aceptar.
          </p>
          <Link
            href={`/login?next=/invitacion/${token}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "14px 20px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              borderRadius: 11, color: "#fff", fontSize: 14, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(37,99,235,.35)",
            }}
          >
            <span>Iniciar sesión</span>
            <ArrowRight size={15} />
          </Link>
        </>
      ) : emailMismatch ? (
        <>
          <div style={{
            background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.3)",
            borderRadius: 10, padding: 12, marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#fcd34d", lineHeight: 1.5, margin: 0 }}>
              Estás autenticado como <b>{userEmail}</b>, pero esta invitación es para <b>{preview.email}</b>.
              Cierra sesión y vuelve a entrar con el email correcto.
            </p>
          </div>
          <button onClick={cerrarSesion} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "12px 20px",
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: 10, color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}>
            <LogOut size={14} />
            <span>Cerrar sesión y reintentar</span>
          </button>
        </>
      ) : (
        <button onClick={aceptar} disabled={accepting} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "14px 20px",
          background: accepting
            ? "rgba(37,99,235,.4)"
            : "linear-gradient(135deg, #2563eb, #1d4ed8)",
          border: "none", borderRadius: 11,
          color: "#fff", fontSize: 14, fontWeight: 700,
          cursor: accepting ? "not-allowed" : "pointer",
          boxShadow: "0 4px 20px rgba(37,99,235,.35)",
          transition: "all .15s",
        }}>
          <span>{accepting ? "Aceptando..." : `Unirme a ${preview.empresa_nombre}`}</span>
          {!accepting && <ArrowRight size={15} />}
        </button>
      )}
    </>
  );
}
