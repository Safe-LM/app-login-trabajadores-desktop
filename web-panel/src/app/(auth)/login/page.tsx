"use client";

import { useState, useEffect, useRef } from "react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName]         = useState("");
  
  // SPA-style visual states
  const [state, setState]       = useState<"login" | "signup" | "forgot">("login");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [capsOn, setCapsOn]     = useState(false);
  const [shake, setShake]       = useState(false);

  // Dynamic height morphing variables
  const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);
  const formContentRef = useRef<HTMLDivElement>(null);

  // Measure form container offset height to morph card container smoothly
  useEffect(() => {
    if (formContentRef.current) {
      setCardHeight(formContentRef.current.offsetHeight);
    }
  }, [state, error, successMsg, capsOn, email, password, confirmPassword, name]);

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

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }

  const handleStateChange = (newState: "login" | "signup" | "forgot") => {
    setError(null);
    setSuccessMsg(null);
    setShowPass(false);
    setShowConfirmPass(false);
    setPassword("");
    setConfirmPassword("");
    setName("");
    setState(newState);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      if (state === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("invalid login")) {
            triggerError("Credenciales incorrectas. Verifica tu correo y contraseña.");
          } else if (error.message.toLowerCase().includes("email not confirmed")) {
            triggerError("Confirma tu correo electrónico antes de ingresar.");
          } else {
            triggerError(error.message);
          }
          setLoading(false);
          return;
        }
        router.refresh();
        router.push("/dashboard");

      } else if (state === "signup") {
        if (!name.trim()) {
          triggerError("Por favor ingresa tu nombre completo.");
          setLoading(false);
          return;
        }
        // TODO(security): Validate password length against security guidelines (12+ characters recommended)
        if (password.length < 12) {
          triggerError("La contraseña debe tener al menos 12 caracteres.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          triggerError("Las contraseñas no coinciden.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: name.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          }
        });

        if (error) {
          triggerError(error.message);
          setLoading(false);
          return;
        }

        setSuccessMsg(
          "Registro exitoso. Te hemos enviado un enlace de confirmación por correo electrónico. Por favor verifica tu bandeja de entrada."
        );
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");

      } else if (state === "forgot") {
        if (!email.trim()) {
          triggerError("Por favor ingresa tu correo electrónico.");
          setLoading(false);
          return;
        }

        const redirectTo = `${window.location.origin}/auth/callback?next=/restablecer`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });

        if (error) {
          triggerError(error.message);
          setLoading(false);
          return;
        }

        setSuccessMsg(
          "Hemos enviado un enlace seguro para restablecer tu contraseña a tu correo electrónico."
        );
        setEmail("");
      }
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
        {/* Gradient mesh estatico */}
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

            <header className="login__form-header stagger-in stagger-delay-1" key={`header-${state}`}>
              <h2 className="login__form-title">
                {state === "login" && "Bienvenido de nuevo"}
                {state === "signup" && "Crear una cuenta"}
                {state === "forgot" && "Recuperar contraseña"}
              </h2>
              <p className="login__form-sub">
                {state === "login" && "Inicia sesión para acceder a tu panel."}
                {state === "signup" && "Regístrate para comenzar a monitorear."}
                {state === "forgot" && "Ingresa tu correo para recibir un enlace seguro."}
              </p>
            </header>

            {successMsg ? (
              <div className="stagger-in stagger-delay-2 flex flex-col items-center text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-soft border border-[#22c55e]/30 text-[#22c55e] flex items-center justify-center mb-4">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="heading-3 mb-2">¡Todo listo!</h3>
                <p className="text-body text-sm text-secondary mb-6">{successMsg}</p>
                <button
                  onClick={() => handleStateChange("login")}
                  className="btn btn-secondary btn-block"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login__form" noValidate key={`form-${state}`}>
                {state === "signup" && (
                  <div className="stagger-in stagger-delay-1">
                    <Field label="Nombre completo" htmlFor="name">
                      <div className="login__input-wrap">
                        <Shield size={14} strokeWidth={2} className="login__input-icon" />
                        <input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="Juan Pérez"
                          className="input login__input"
                          autoComplete="name"
                          autoFocus
                        />
                      </div>
                    </Field>
                  </div>
                )}

                <div className={`stagger-in ${state === "signup" ? "stagger-delay-2" : "stagger-delay-1"}`}>
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
                        autoFocus={state !== "signup"}
                      />
                    </div>
                  </Field>
                </div>

                {state !== "forgot" && (
                  <>
                    <div className={`stagger-in ${state === "signup" ? "stagger-delay-3" : "stagger-delay-2"}`}>
                      <Field
                        label="Contraseña"
                        htmlFor="password"
                        trailing={
                          state === "login" && (
                            <button
                              type="button"
                              className="login__inline-link"
                              onClick={() => handleStateChange("forgot")}
                              tabIndex={-1}
                            >
                              ¿Olvidaste tu contraseña?
                            </button>
                          )
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
                            autoComplete={state === "login" ? "current-password" : "new-password"}
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
                        {state === "login" && capsOn && password.length > 0 && (
                          <span className="login__hint login__hint--warn">
                            <AlertCircle size={11} strokeWidth={2.25} /> Caps Lock activado
                          </span>
                        )}
                      </Field>
                    </div>

                    {state === "signup" && (
                      <div className="stagger-in stagger-delay-4">
                        <Field label="Confirmar contraseña" htmlFor="confirmPassword">
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
                    )}
                  </>
                )}

                {error && (
                  <div className="login__error" role="alert">
                    <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`btn btn-primary login__submit stagger-in ${
                    state === "signup"
                      ? "stagger-delay-5"
                      : state === "login"
                      ? "stagger-delay-3"
                      : "stagger-delay-2"
                  }`}
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={14} strokeWidth={2.5} className="animate-spin-slow" />
                      {state === "login" && "Verificando…"}
                      {state === "signup" && "Registrando…"}
                      {state === "forgot" && "Enviando enlace…"}
                    </>
                  ) : (
                    <>
                      {state === "login" && "Ingresar al panel"}
                      {state === "signup" && "Crear cuenta"}
                      {state === "forgot" && "Enviar enlace de recuperación"}
                      <ChevronRight size={14} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {!successMsg && (
              <footer className="login__form-footer" key={`footer-${state}`}>
                <span className="login__form-meta">
                  {state === "login" && (
                    <>
                      ¿Aún no tienes cuenta?{" "}
                      <button
                        type="button"
                        onClick={() => handleStateChange("signup")}
                        className="login__inline-link login__inline-link--strong"
                      >
                        Regístrate aquí
                      </button>
                    </>
                  )}
                  {state === "signup" && (
                    <>
                      ¿Ya tienes una cuenta?{" "}
                      <button
                        type="button"
                        onClick={() => handleStateChange("login")}
                        className="login__inline-link login__inline-link--strong"
                      >
                        Inicia sesión
                      </button>
                    </>
                  )}
                  {state === "forgot" && (
                    <>
                      ¿Recordaste tu contraseña?{" "}
                      <button
                        type="button"
                        onClick={() => handleStateChange("login")}
                        className="login__inline-link login__inline-link--strong"
                      >
                        Inicia sesión
                      </button>
                    </>
                  )}
                </span>
              </footer>
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
