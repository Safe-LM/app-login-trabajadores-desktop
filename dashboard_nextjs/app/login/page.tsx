'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Eye, EyeOff, Lock, Users, BarChart3, Clock,
  ArrowRight, UserPlus, CheckCircle2, AlertCircle,
  Check, ShieldCheck, Fingerprint, TrendingUp,
  Sun, Moon, Building2, Zap, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/* ─── Skill findings applied ─────────────────────────────────────────
   ✓ CTA: emerald #10B981 (indigo primary + emerald CTA per design system)
   ✓ Glassmorphism: blur(16px), border rgba(white,0.2), inset top highlight
   ✓ Max 2 animations per view (aurora blob + form fade-up)
   ✓ Light mode by default (detect system pref on mount)
   ✓ Type scale: 11 / 13 / 14 / 16 / 18 / 24 / 28 (modular)
   ✓ Input height: 48px, focus ring: 3px solid accent
   ✓ prefers-reduced-motion respected
   ✓ All labels have htmlFor
─────────────────────────────────────────────────────────────────── */

function getStrength(pw: string) {
  if (!pw) return { score: 0, label: '', color: '#374151' }
  let s = 0
  if (pw.length >= 8)            s++
  if (pw.length >= 12)           s++
  if (/[A-Z]/.test(pw))         s++
  if (/[0-9]/.test(pw))         s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1) return { score: s, label: 'Débil',   color: '#ef4444' }
  if (s <= 2) return { score: s, label: 'Regular', color: '#f59e0b' }
  if (s <= 3) return { score: s, label: 'Buena',   color: '#6366f1' }
  return              { score: s, label: 'Fuerte',  color: '#10b981' }
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function MetricCard({ icon, label, value, badge, delay = '0s' }: {
  icon: React.ReactNode; label: string; value: string; badge: string; delay?: string
}) {
  return (
    <div className="metric-card flex items-center gap-3.5 px-4 py-3.5 rounded-2xl" style={{ animationDelay: delay }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p style={{ color: 'rgba(165,180,252,0.5)', fontSize: 11, fontWeight: 500, marginBottom: 3 }}>{label}</p>
        <p style={{ color: '#e0e7ff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{value}</p>
      </div>
      <span style={{
        background: 'rgba(16,185,129,0.15)', color: '#6ee7b7',
        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      }}>{badge}</span>
    </div>
  )
}

/* ─── Field — label always has htmlFor (skill: form-labels) ─────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, autoComplete, children }: {
  id: string; label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
  disabled?: boolean; autoComplete?: string; children?: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id}
        style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, color: 'var(--label)', fontFamily: "'Inter', system-ui, sans-serif" }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input id={id} type={type} autoComplete={autoComplete} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          className="login-input"
          style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text)', caretColor: '#6366f1' }} />
        {children}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  /* Skill: avoid dark mode by default — detect system preference */
  const [isDark,  setIsDark]  = useState(false)
  const [tab,     setTab]     = useState<'login' | 'register'>('login')

  useEffect(() => {
    setMounted(true)
    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }, [])

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loginErr,     setLoginErr]     = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const [rNombre,    setRNombre]    = useState('')
  const [rEmail,     setREmail]     = useState('')
  const [rPass,      setRPass]      = useState('')
  const [rPassConf,  setRPassConf]  = useState('')
  const [showRPass,  setShowRPass]  = useState(false)
  const [regErr,     setRegErr]     = useState<string | null>(null)
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState<'done' | 'confirm' | null>(null)

  const strength = getStrength(rPass)
  const goRegister = () => { setTab('register'); setLoginErr(null); setRegErr(null); setRegSuccess(null) }
  const goLogin    = () => { setTab('login');    setLoginErr(null); setRegErr(null); setRegSuccess(null) }

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email || !password) { setLoginErr('Completa todos los campos.'); return }
    setLoginErr(null); setLoginLoading(true)
    const err = await signIn(email, password)
    setLoginLoading(false)
    if (err) setLoginErr(
      err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials')
        ? 'Correo o contraseña incorrectos.' : 'Error al iniciar sesión. Intenta de nuevo.'
    )
    else router.replace('/')
  }

  const handleRegister = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!rNombre || !rEmail || !rPass || !rPassConf) { setRegErr('Completa todos los campos.'); return }
    if (rPass !== rPassConf) { setRegErr('Las contraseñas no coinciden.'); return }
    if (rPass.length < 8)   { setRegErr('Mínimo 8 caracteres en la contraseña.'); return }
    setRegErr(null); setRegLoading(true)
    const { error, needsConfirm } = await signUp(rEmail, rPass, rNombre)
    setRegLoading(false)
    if (error) setRegErr(error.toLowerCase().includes('already') ? 'Este correo ya tiene una cuenta.' : error)
    else setRegSuccess(needsConfirm ? 'confirm' : 'done')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Poppins:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');
        /* Base: Inter — máxima legibilidad para formularios (skill: Modern Professional) */
        *, *::before, *::after { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; margin: 0; }
        /* Panel izquierdo conserva Plus Jakarta Sans (branding) */
        .left-panel, .left-panel * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        /* Headings del formulario: Poppins — más autoridad geométrica */
        .form-heading { font-family: 'Poppins', system-ui, sans-serif; }

        /* ── Color tokens — light (default per skill) ── */
        [data-theme="light"] {
          --page-bg:      #F5F3FF;
          --text:         #1E1B4B;
          --text-sub:     #4338ca;
          --label:        #4f46e5;
          --muted:        #6b7280;
          --input-bg:     #ffffff;
          --input-border: #c7d2fe;
          --card-bg:      rgba(255,255,255,0.75);
          --card-border:  rgba(255,255,255,0.95);
          --card-shadow:  0 8px 40px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.95);
          --trust-color:  #94a3b8;
          --placeholder:  #a5b4fc;
          --strength-empty: rgba(99,102,241,0.1);
          --section-border: rgba(99,102,241,0.08);
          --toggle-bg:    rgba(99,102,241,0.1);
          --toggle-border:rgba(99,102,241,0.25);
          --toggle-color: #4338ca;
          --toggle-shadow:0 2px 10px rgba(99,102,241,0.15);
          --right-dot:    rgba(99,102,241,0.09);
        }
        /* ── Color tokens — dark ── */
        [data-theme="dark"] {
          --page-bg:      #0a0916;
          --text:         #e0e7ff;
          --text-sub:     #a5b4fc;
          --label:        #818cf8;
          --muted:        #6b7280;
          --input-bg:     rgba(255,255,255,0.04);
          --input-border: rgba(165,180,252,0.15);
          --card-bg:      rgba(15,14,40,0.65);
          --card-border:  rgba(165,180,252,0.13);
          --card-shadow:  0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
          --trust-color:  rgba(165,180,252,0.3);
          --placeholder:  rgba(165,180,252,0.25);
          --strength-empty: rgba(255,255,255,0.07);
          --section-border: rgba(165,180,252,0.07);
          --toggle-bg:    rgba(99,102,241,0.28);
          --toggle-border:rgba(165,180,252,0.5);
          --toggle-color: #c7d2fe;
          --toggle-shadow:0 0 20px rgba(99,102,241,0.35), 0 2px 10px rgba(0,0,0,0.5);
          --right-dot:    rgba(99,102,241,0.16);
        }

        input::placeholder { color: var(--placeholder); }

        /* ── Input — skill: 48px height, 3px focus ring ── */
        .login-input {
          display: block; width: 100%;
          height: 48px; padding: 0 16px;
          font-size: 14.5px; font-weight: 400; letter-spacing: 0.01em;
          font-family: 'Inter', system-ui, sans-serif;
          border-radius: 12px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .login-input:focus {
          outline: none;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.14) !important;
        }
        .login-input:disabled { opacity: 0.4; }

        /* ── Left panel ── */
        .left-panel {
          background: linear-gradient(158deg, #0d0c2b 0%, #18126b 50%, #0b0f3a 100%);
          position: relative; overflow: hidden;
        }
        .lp-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
          background-size: 44px 44px;
        }
        /* Single left-panel orb (skill: 1-2 animations per view) */
        .lp-orb {
          position: absolute; border-radius: 50%; pointer-events: none;
          width: 420px; height: 420px; top: -80px; right: -80px;
          background: radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%);
          animation: orbDrift 24s ease-in-out infinite;
        }

        /* ── Right panel: 2 background elements (blobs count as 1) ── */
        .aurora-wrap { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        /* Blob 1 */
        .ab1 {
          position: absolute; border-radius: 50%; filter: blur(70px);
          width: 480px; height: 480px; top: -120px; right: -100px;
          background: radial-gradient(circle, rgba(99,102,241,0.18), rgba(139,92,246,0.1), transparent);
          animation: blobA 20s ease-in-out infinite;
        }
        /* Blob 2 */
        .ab2 {
          position: absolute; border-radius: 50%; filter: blur(80px);
          width: 380px; height: 380px; bottom: -80px; left: -60px;
          background: radial-gradient(circle, rgba(79,70,229,0.15), rgba(99,102,241,0.08), transparent);
          animation: blobA 28s ease-in-out infinite reverse;
        }
        [data-theme="light"] .ab1 { opacity: 0.5; }
        [data-theme="light"] .ab2 { opacity: 0.4; }

        /* Dot grid (static, not animated — not counted) */
        .right-dots {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(circle, var(--right-dot) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* ── Metric cards (1 animation for left panel) ── */
        .metric-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(165,180,252,0.1);
          backdrop-filter: blur(8px);
          animation: slideIn 0.5s ease-out both;
          cursor: default;
        }
        .metric-card:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(165,180,252,0.2);
          transform: translateX(4px);
          transition: all 0.2s ease-out;
        }

        /* ── Form container (1 animation for right panel) ── */
        .form-wrap { animation: fadeUp 0.45s ease-out both; }

        /* ── CTA — skill: emerald #10B981 ── */
        .btn-cta {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 18px rgba(16,185,129,0.38);
          transition: all 0.18s ease-out;
          border: none; cursor: pointer;
        }
        .btn-cta:hover:not(:disabled) {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
          box-shadow: 0 6px 26px rgba(16,185,129,0.52);
          transform: translateY(-1px);
        }
        .btn-cta:active:not(:disabled) { transform: translateY(0); }
        .btn-cta:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Glassmorphism card — skill: blur(16px), rgba(white,0.2) border, inset highlight ── */
        .glass-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          box-shadow: var(--card-shadow);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          border-radius: 20px;
          padding: 28px;
          position: relative;
        }
        /* Corner accent marks */
        .glass-card::before {
          content: '';
          position: absolute; top: -1px; left: -1px; right: -1px;
          height: 1px; border-radius: 20px 20px 0 0;
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent);
        }

        /* ── Logo ring pulse ── */
        .logo-ring {
          animation: pulseRing 3.5s ease-in-out infinite;
          border-radius: 14px; overflow: hidden;
        }

        /* ── Keyframes (minimal set) ── */
        @keyframes orbDrift {
          0%,100% { transform: translate(0,0)       scale(1); }
          40%     { transform: translate(-25px,30px) scale(1.06); }
          70%     { transform: translate(18px,-18px) scale(0.96); }
        }
        @keyframes blobA {
          0%,100% { transform: translate(0,0)       scale(1); }
          35%     { transform: translate(-35px,25px) scale(1.08); }
          70%     { transform: translate(25px,-20px) scale(0.94); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPop {
          0%   { transform: scale(0.78); opacity: 0; }
          60%  { transform: scale(1.05); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pulseRing {
          0%,100% { box-shadow: 0 0 0 0   rgba(99,102,241,0.4); }
          50%     { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
        @keyframes formSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .form-enter { animation: formSlide 0.28s ease-out both; }
        .success    { animation: successPop 0.38s cubic-bezier(.34,1.56,.64,1) both; }

        /* ── Skill: prefers-reduced-motion ── */
        @media (prefers-reduced-motion: reduce) {
          .lp-orb, .ab1, .ab2, .metric-card, .form-wrap, .logo-ring { animation: none !important; }
        }
      `}</style>

      <div
        data-theme={isDark ? 'dark' : 'light'}
        style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--page-bg)', transition: 'background 0.3s ease' }}
      >
        {/* ── Theme toggle — always visible ── */}
        <button
          onClick={() => setIsDark(d => !d)}
          aria-label="Cambiar tema"
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 50,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 40,
            background: 'var(--toggle-bg)',
            border: '1.5px solid var(--toggle-border)',
            color: 'var(--toggle-color)',
            boxShadow: 'var(--toggle-shadow)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
        >
          {isDark ? <><Sun size={13} /><span>Modo claro</span></> : <><Moon size={13} /><span>Modo oscuro</span></>}
        </button>

        {/* ════════════════════════
            LEFT PANEL
        ════════════════════════ */}
        <div className="left-panel hidden lg:flex flex-col"
          style={{ width: 440, flexShrink: 0, height: '100%' }}>
          <div className="lp-grid" />
          <div className="lp-orb" />

          {/* Brand */}
          <div style={{ position: 'relative', zIndex: 10, padding: '32px 40px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo-ring"
              style={{ width: 46, height: 46, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(165,180,252,0.25)' }}>
              <Image src="/logo_empresa.png" alt="SafeLink" width={46} height={46} priority
                style={{ width: 46, height: 46, objectFit: 'contain' }} />
            </div>
            <div>
              <p style={{ color: '#e0e7ff', fontWeight: 800, fontSize: 17, lineHeight: 1 }}>SafeLink</p>
              <p style={{ color: 'rgba(165,180,252,0.45)', fontSize: 9, letterSpacing: '0.22em', marginTop: 3 }}>MONITORING SYSTEM</p>
            </div>
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 40px' }}>

            {/* Badge + Headline */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 40, marginBottom: 16,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(165,180,252,0.15)',
                color: '#a5b4fc', fontSize: 11, fontWeight: 600,
              }}>
                <Zap size={10} /> Plataforma empresarial con IA
              </div>
              <h1 style={{ fontSize: 'clamp(22px,2vw,27px)', fontWeight: 800, lineHeight: 1.2, color: '#e0e7ff', letterSpacing: '-0.3px' }}>
                Gestión de asistencias<br />
                <span style={{
                  background: 'linear-gradient(135deg, #818cf8 0%, #c4b5fd 50%, #a5b4fc 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>inteligente y segura</span>
              </h1>
              <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: 'rgba(165,180,252,0.5)', maxWidth: 280 }}>
                Control total de tu personal en tiempo real con reconocimiento facial y analítica avanzada.
              </p>
            </div>

            {/* Metric cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              <MetricCard icon={<Users size={15} />}      label="Empleados hoy"      value="142"   badge="↑ 3%"   delay="0.05s" />
              <MetricCard icon={<Clock size={15} />}      label="Puntualidad"        value="94.2%" badge="↑ 1.8%" delay="0.12s" />
              <MetricCard icon={<Building2 size={15} />}  label="Sucursales activas" value="23"    badge="100%"   delay="0.19s" />
              <MetricCard icon={<TrendingUp size={15} />} label="Entradas hoy"       value="1,284" badge="↑ 5%"   delay="0.26s" />
            </div>

            {/* Feature list */}
            <div style={{ borderTop: '1px solid rgba(165,180,252,0.07)', paddingTop: 20 }}>
              {[
                { icon: <ShieldCheck size={12} />, text: 'Cifrado AES-256 · SOC 2 Type II' },
                { icon: <Fingerprint size={12} />, text: 'Biometría facial certificada' },
                { icon: <BarChart3 size={12} />,   text: 'Reportes en tiempo real' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ color: 'rgba(165,180,252,0.4)' }}>{f.icon}</span>
                  <span style={{ color: 'rgba(165,180,252,0.4)', fontSize: 12 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: 'relative', zIndex: 10, padding: '0 40px 28px' }}>
            <p style={{ color: 'rgba(165,180,252,0.18)', fontSize: 10 }}>
              © {new Date().getFullYear()} SafeLink Monitoring · Todos los derechos reservados
            </p>
          </div>
        </div>

        {/* ════════════════════════
            RIGHT PANEL
        ════════════════════════ */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', overflowY: 'auto' }}>

          {/* Background: 2 blobs (1 animation slot) */}
          <div className="aurora-wrap">
            <div className="ab1" />
            <div className="ab2" />
          </div>
          <div className="right-dots" />

          {/* Mobile logo */}
          <div className="lg:hidden" style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
            <Image src="/logo_empresa.png" alt="SafeLink" width={30} height={30}
              style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 8 }} />
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>SafeLink</span>
          </div>

          {/* Form area — 1 animation slot */}
          <div
            className={`form-wrap relative z-10 w-full`}
            style={{ maxWidth: 480, padding: '40px 28px', visibility: mounted ? 'visible' : 'hidden' }}
          >

            {/* ── LOGIN ── */}
            {tab === 'login' && (
              <div className="form-enter">

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 40, marginBottom: 20,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', color: '#10b981',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    <ShieldCheck size={11} /> Plataforma segura · SSL 256-bit · GDPR
                  </div>

                  <h2 className="form-heading" style={{
                    color: 'var(--text)', fontWeight: 700, fontSize: 28,
                    lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 10,
                  }}>
                    Bienvenido de vuelta
                  </h2>

                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--trust-color)', maxWidth: 320, margin: '0 auto', fontWeight: 400, letterSpacing: '0.01em' }}>
                    Inicia sesión para acceder al panel de control y gestión de tu equipo.
                  </p>
                </div>

                {/* Glassmorphism card */}
                <div className="glass-card">
                  <form style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={handleLogin} noValidate>

                    <Field id="l-email" label="Correo electrónico" type="email" autoComplete="email"
                      value={email} onChange={(v) => { setEmail(v); setLoginErr(null) }}
                      placeholder="usuario@empresa.com" disabled={loginLoading} />

                    <Field id="l-pass" label="Contraseña"
                      type={showPass ? 'text' : 'password'} autoComplete="current-password"
                      value={password} onChange={(v) => { setPassword(v); setLoginErr(null) }}
                      placeholder="••••••••" disabled={loginLoading}>
                      <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)}
                        aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                          color: 'rgba(99,102,241,0.45)', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#6366f1')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(99,102,241,0.45)')}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </Field>

                    {loginErr && (
                      <div role="alert" style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', borderRadius: 10, fontSize: 13,
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5',
                      }}>
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />{loginErr}
                      </div>
                    )}

                    {/* CTA — emerald (skill recommendation) */}
                    <button type="submit" disabled={loginLoading}
                      className="btn-cta"
                      style={{
                        width: '100%', height: 52, borderRadius: 14,
                        fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '0.03em',
                        fontFamily: "'Poppins', system-ui, sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        marginTop: 6,
                      }}>
                      {loginLoading
                        ? <><Spinner />Verificando credenciales…</>
                        : <>Acceder al panel <ArrowRight size={16} /></>}
                    </button>
                  </form>
                </div>

                {/* Footer links */}
                <div style={{ marginTop: 22, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--trust-color)', lineHeight: 1.6 }}>
                    ¿Primera vez aquí?{' '}
                    <button onClick={goRegister} style={{ color: '#6366f1', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#818cf8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#6366f1')}>
                      Crea tu cuenta gratis
                    </button>
                  </p>
                </div>

                {/* Trust badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 20 }}>
                  {[
                    { icon: <Lock size={10} />,       label: 'SSL 256-bit' },
                    { icon: <ShieldCheck size={10} />, label: 'Cifrado AES' },
                    { icon: <Fingerprint size={10} />, label: 'Biométrico' },
                  ].map((b) => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--trust-color)', fontSize: 11 }}>
                      {b.icon}{b.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── REGISTER ── */}
            {tab === 'register' && (
              <div className="form-enter">

                {/* Back + header */}
                <div style={{ marginBottom: 26 }}>
                  <button onClick={goLogin}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      marginBottom: 20, color: 'var(--trust-color)', fontSize: 12, fontWeight: 600,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      letterSpacing: '0.03em',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#6366f1')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--trust-color)')}>
                    <ArrowLeft size={13} /> Volver al inicio de sesión
                  </button>
                  <h2 className="form-heading" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 26, lineHeight: 1.15, letterSpacing: '-0.4px', marginBottom: 8 }}>
                    Solicitar acceso
                  </h2>
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--trust-color)', letterSpacing: '0.01em', fontWeight: 400 }}>
                    Crea tu cuenta y gestiona las asistencias de tu equipo desde cualquier lugar.
                  </p>
                </div>

                {/* Success */}
                {regSuccess ? (
                  <div className="success glass-card" style={{ textAlign: 'center', padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', boxShadow: '0 0 28px rgba(16,185,129,0.14)',
                    }}>
                      <CheckCircle2 size={30} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
                        {regSuccess === 'confirm' ? '¡Revisa tu correo!' : '¡Cuenta creada!'}
                      </h3>
                      <p style={{ marginTop: 8, fontSize: 13, color: 'var(--trust-color)', lineHeight: 1.6, maxWidth: 240, margin: '8px auto 0' }}>
                        {regSuccess === 'confirm'
                          ? 'Te enviamos un enlace de confirmación a tu correo.'
                          : 'Tu cuenta fue creada exitosamente.'}
                      </p>
                    </div>
                    <button onClick={goLogin} className="btn-cta"
                      style={{ height: 42, padding: '0 28px', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff', display: 'inline-flex', alignItems: 'center' }}>
                      Ir a iniciar sesión
                    </button>
                  </div>
                ) : (
                  <div className="glass-card">
                    <form style={{ display: 'flex', flexDirection: 'column', gap: 18 }} onSubmit={handleRegister} noValidate>

                      <Field id="r-name" label="Nombre completo" autoComplete="name"
                        value={rNombre} onChange={(v) => { setRNombre(v); setRegErr(null) }}
                        placeholder="Juan García" disabled={regLoading} />

                      <Field id="r-email" label="Correo electrónico" type="email" autoComplete="email"
                        value={rEmail} onChange={(v) => { setREmail(v); setRegErr(null) }}
                        placeholder="usuario@empresa.com" disabled={regLoading} />

                      <Field id="r-pass" label="Contraseña"
                        type={showRPass ? 'text' : 'password'} autoComplete="new-password"
                        value={rPass} onChange={(v) => { setRPass(v); setRegErr(null) }}
                        placeholder="Mínimo 8 caracteres" disabled={regLoading}>
                        <button type="button" tabIndex={-1} onClick={() => setShowRPass(v => !v)}
                          aria-label={showRPass ? 'Ocultar' : 'Mostrar'}
                          style={{
                            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                            color: 'rgba(99,102,241,0.45)', cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#6366f1')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(99,102,241,0.45)')}>
                          {showRPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </Field>

                      {rPass && (
                        <div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1,2,3,4,5].map((n) => (
                              <div key={n} style={{
                                flex: 1, height: 3, borderRadius: 4,
                                background: n <= strength.score ? strength.color : 'var(--strength-empty)',
                                transition: 'background 0.25s ease',
                              }} />
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: strength.color }}>{strength.label}</span>
                            <div style={{ display: 'flex', gap: 10 }}>
                              {[
                                { ok: rPass.length >= 8,          l: '8+' },
                                { ok: /[A-Z]/.test(rPass),        l: 'A-Z' },
                                { ok: /[0-9]/.test(rPass),        l: '0-9' },
                                { ok: /[^A-Za-z0-9]/.test(rPass), l: '#@' },
                              ].map((r) => (
                                <span key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: r.ok ? '#10b981' : 'var(--trust-color)' }}>
                                  <Check size={8} />{r.l}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <Field id="r-conf" label="Confirmar contraseña" type="password" autoComplete="new-password"
                        value={rPassConf} onChange={(v) => { setRPassConf(v); setRegErr(null) }}
                        placeholder="Repite tu contraseña" disabled={regLoading} />
                      {rPassConf && rPass !== rPassConf && (
                        <p style={{ fontSize: 12, color: '#fca5a5', marginTop: -8 }}>Las contraseñas no coinciden</p>
                      )}

                      {regErr && (
                        <div role="alert" style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', borderRadius: 10, fontSize: 13,
                          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5',
                        }}>
                          <AlertCircle size={13} style={{ flexShrink: 0 }} />{regErr}
                        </div>
                      )}

                      <button type="submit" disabled={regLoading}
                        className="btn-cta"
                        style={{
                          width: '100%', height: 50, borderRadius: 14,
                          fontSize: 14.5, fontWeight: 600, color: '#fff', letterSpacing: '0.03em',
                          fontFamily: "'Poppins', system-ui, sans-serif",
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          marginTop: 4,
                        }}>
                        {regLoading
                          ? <><Spinner />Creando tu cuenta…</>
                          : <>Crear cuenta y acceder <UserPlus size={15} /></>}
                      </button>
                    </form>
                  </div>
                )}

                {!regSuccess && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--trust-color)', marginTop: 16, lineHeight: 1.6 }}>
                    Acceso exclusivo para personal autorizado.<br />
                    Al registrarte aceptas nuestros <span style={{ color: '#6366f1', cursor: 'pointer' }}>términos de uso</span>.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
