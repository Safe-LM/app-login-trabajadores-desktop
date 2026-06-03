"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Shield, Eye, EyeOff, AlertCircle, LoaderCircle, ChevronRight,
  Lock, ShieldCheck, Globe2, Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function RestablecerPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [shake, setShake] = useState(false);

  // Dynamic height morphing variables
  const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);
  const formContentRef = useRef<HTMLDivElement>(null);

  // Measure form container offset height to morph card container smoothly
  useEffect(() => {
    if (formContentRef.current) {
      setCardHeight(formContentRef.current.offsetHeight);
    }
  }, [checking, error, successMsg, capsOn, password, confirmPassword]);

  // Check if session is active
  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login?error=Debes+iniciar+sesión+o+usar+un+enlace+válido+para+restablecer+tu+contraseña.");
        } else {
          setChecking(false);
        }
      } catch {
        router.replace("/login?error=Error+al+verificar+sesión.+Intenta+de+nuevo.");
      }
    }
    checkSession();
  }, [router]);

  // Detector de Caps Lock
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

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (password.length < 12) {
        triggerError("La nueva contraseña debe tener al menos 12 caracteres.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        triggerError("Las contraseñas no coinciden.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        triggerError(error.message);
        setLoading(false);
        return;
      }

      setSuccessMsg("Tu contraseña ha sido restablecida exitosamente.");
      
      // Auto redirect to dashboard after 2.5 seconds
      setTimeout(() => {
        router.replace("/dashboard");
      }, 2500);

    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        triggerError("Sin conexión al servidor. Verifica tu internet o contacta soporte.");
      } else {
        triggerError("Error inesperado. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      {/* ─── PANEL IZQUIERDO: editorial hero ─── */}
      <aside className="login__hero hidden lg:flex">
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
        {/* Ambient Glowing Orbs */}
        <div className="login__orb login__orb--1 animate-ambient-1" aria-hidden="true" />
        <div className="login__orb login__orb--2 animate-ambient-2" aria-hidden="true" />

        <div
          className={`login__form-card ${shake ? "animate-shake" : ""}`}
          style={{
            height: cardHeight ? `${cardHeight}px` : "auto",
            transition: "height 300ms cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div ref={formContentRef} className="login__form-content">
            {/* Brand mark mobile */}
            <div className="lg:hidden login__brand login__brand--mobile">
              <div className="login__brand-mark">
                <Shield size={16} strokeWidth={2.5} color="#fff" />
              </div>
              <div>
                <p className="login__brand-name">Safe Link</p>
                <p className="login__brand-tagline">Monitoring</p>
              </div>
            </div>

            <header className="login__form-header stagger-in stagger-delay-1">
              <h2 className="login__form-title">Restablecer contraseña</h2>
              <p className="login__form-sub">
                Ingresa tu nueva contraseña para volver a acceder al sistema de forma segura.
              </p>
            </header>

            {checking ? (
              <div className="flex flex-col items-center justify-center py-12 text-center stagger-in stagger-delay-2">
                <LoaderCircle size={28} strokeWidth={2.5} className="animate-spin-slow text-[#2563eb] mb-4" />
                <p className="text-muted-sm">Validando sesión de restablecimiento...</p>
              </div>
            ) : successMsg ? (
              <div className="stagger-in stagger-delay-2 flex flex-col items-center text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-soft border border-[#22c55e]/30 text-[#22c55e] flex items-center justify-center mb-4">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="heading-3 mb-2">¡Todo listo!</h3>
                <p className="text-body text-sm text-secondary mb-6">{successMsg}</p>
                <p className="text-muted-sm text-xs">Redirigiendo a tu tablero...</p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="login__form" noValidate>
                <div className="stagger-in stagger-delay-1">
                  <Field label="Nueva contraseña" htmlFor="password">
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
                        autoComplete="new-password"
                        autoFocus
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
                </div>

                <div className="stagger-in stagger-delay-2">
                  <Field label="Confirmar nueva contraseña" htmlFor="confirmPassword">
                    <div className="login__input-wrap">
                      <Lock size={14} strokeWidth={2} className="login__input-icon" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="input login__input"
                        style={{ paddingLeft: 38, paddingRight: 42 }}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="login__pass-toggle"
                        aria-label={showConfirmPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                        tabIndex={-1}
                      >
                        {showConfirmPass ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                      </button>
                    </div>
                  </Field>
                </div>

                {error && (
                  <div className="login__error" role="alert">
                    <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary login__submit stagger-in stagger-delay-3"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={14} strokeWidth={2.5} className="animate-spin-slow" />
                      Actualizando contraseña…
                    </>
                  ) : (
                    <>
                      Restablecer contraseña
                      <ChevronRight size={14} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
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
