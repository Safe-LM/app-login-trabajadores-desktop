"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Shield, Eye, EyeOff, AlertCircle, LoaderCircle, ChevronRight,
  Lock, Mail, ShieldCheck, Globe2, Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [capsOn, setCapsOn]     = useState(false);

  // Detector de Caps Lock — pista util en passwords case-sensitive
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (typeof e.getModifierState === "function") {
        setCapsOn(e.getModifierState("CapsLock"));
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

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
    } catch (err: unknown) {
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
    <div className="login">
      {/* ─── PANEL IZQUIERDO: editorial hero ─── */}
      <aside className="login__hero hidden lg:flex">
        {/* Gradient mesh estatico (no anima — solo profundidad de fondo) */}
        <div className="login__mesh" aria-hidden="true" />

        {/* Brand top */}
        <div className="login__brand">
          <div className="login__brand-mark">
            <Shield size={18} strokeWidth={2.5} color="#fff" />
          </div>
          <div>
            <p className="login__brand-name">Safe Link</p>
            <p className="login__brand-tagline">Monitoring</p>
          </div>
        </div>

        {/* Hero editorial: copy + stats */}
        <div className="login__editorial">
          <p className="login__eyebrow">Asistencia biométrica B2B</p>
          <h1 className="login__headline">
            Tu equipo marca.<br />
            <span className="login__headline--accent">Tu panel responde.</span>
          </h1>
          <p className="login__subhead">
            Reconocimiento facial local en cada estación, sincronización entre
            sucursales y monitoreo en tiempo real desde un solo lugar.
          </p>

          {/* Pills compactos de propuesta de valor */}
          <div className="login__pills">
            <Pill icon={<ShieldCheck size={11} strokeWidth={2.25} />} label="IA local" sub="Sin enviar fotos a la nube" />
            <Pill icon={<Globe2     size={11} strokeWidth={2.25} />} label="Multi-empresa" sub="Aislamiento por tenant" />
            <Pill icon={<Zap        size={11} strokeWidth={2.25} />} label="Tiempo real" sub="Eventos < 200ms" />
          </div>
        </div>

        {/* Footer hero */}
        <footer className="login__footer">
          <StatusBadge kind="live" label="Sistemas operativos" strong />
          <span className="login__copy">© 2026 Safe Link Monitoring</span>
        </footer>
      </aside>

      {/* ─── PANEL DERECHO: formulario ─── */}
      <main className="login__form-wrap">
        <div className="login__form-card animate-fade-up">
          {/* Brand mark mobile (solo se ve cuando se oculta el hero) */}
          <div className="lg:hidden login__brand login__brand--mobile">
            <div className="login__brand-mark">
              <Shield size={16} strokeWidth={2.5} color="#fff" />
            </div>
            <div>
              <p className="login__brand-name">Safe Link</p>
              <p className="login__brand-tagline">Monitoring</p>
            </div>
          </div>

          <header className="login__form-header">
            <h2 className="login__form-title">Bienvenido de nuevo</h2>
            <p className="login__form-sub">
              Inicia sesión para acceder a tu panel.
            </p>
          </header>

          <form onSubmit={handleLogin} className="login__form" noValidate>
            <Field label="Correo electrónico" htmlFor="email">
              <div className="login__input-wrap">
                <Mail size={14} strokeWidth={2} className="login__input-icon" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@empresa.com"
                  className="input login__input"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </Field>

            <Field
              label="Contraseña"
              htmlFor="password"
              trailing={
                <button
                  type="button"
                  className="login__inline-link"
                  onClick={() => alert("Contacta a tu administrador para recuperar la contraseña.")}
                  tabIndex={-1}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              }
            >
              <div className="login__input-wrap">
                <Lock size={14} strokeWidth={2} className="login__input-icon" />
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input login__input"
                  style={{ paddingLeft: 38, paddingRight: 42 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="login__pass-toggle"
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                </button>
              </div>
              {capsOn && password.length > 0 && (
                <span className="login__hint login__hint--warn">
                  <AlertCircle size={11} strokeWidth={2.25} /> Caps Lock activado
                </span>
              )}
            </Field>

            {error && (
              <div className="login__error" role="alert">
                <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary login__submit"
            >
              {loading ? (
                <>
                  <LoaderCircle size={14} strokeWidth={2.5} className="animate-spin-slow" />
                  Verificando…
                </>
              ) : (
                <>
                  Ingresar al panel
                  <ChevronRight size={14} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          <footer className="login__form-footer">
            <span className="login__form-meta">
              ¿Aún no tienes cuenta?{" "}
              <a href="mailto:ventas@safelink.com" className="login__inline-link login__inline-link--strong">
                Contacta a ventas
              </a>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  trailing,
  children,
}: {
  label: string;
  htmlFor?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="login__field">
      <div className="login__field-row">
        <label htmlFor={htmlFor} className="login__field-label">{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function Pill({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="login__pill">
      <span className="login__pill-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p className="login__pill-label">{label}</p>
        <p className="login__pill-sub">{sub}</p>
      </div>
    </div>
  );
}
