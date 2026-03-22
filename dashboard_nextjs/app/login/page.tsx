'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Eye, EyeOff, Shield, Lock, Users, BarChart3,
  Wifi, ArrowRight, UserPlus, CheckCircle2,
  AlertCircle, Check, ShieldCheck, KeyRound, BadgeCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/* ─── Password strength ──────────────────────────────────────────── */
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '#374151' }
  let score = 0
  if (pw.length >= 8)            score++
  if (pw.length >= 12)           score++
  if (/[A-Z]/.test(pw))         score++
  if (/[0-9]/.test(pw))         score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Débil',   color: '#ef4444' }
  if (score <= 2) return { score, label: 'Regular', color: '#f59e0b' }
  if (score <= 3) return { score, label: 'Buena',   color: '#3b82f6' }
  return              { score, label: 'Fuerte',  color: '#22c55e' }
}

/* ─── Static data ────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Users size={14} />,     label: 'Control de asistencias en tiempo real' },
  { icon: <BarChart3 size={14} />, label: 'Analítica por sucursal y período' },
  { icon: <Shield size={14} />,    label: 'Reconocimiento facial con IA' },
  { icon: <Wifi size={14} />,      label: 'Sincronización automática en la nube' },
]

const STATS = [
  { val: '99%',  label: 'Precisión IA',     color: '#22c55e' },
  { val: '<1s',  label: 'Tiempo respuesta', color: '#38bdf8' },
  { val: '24/7', label: 'Disponibilidad',   color: '#f59e0b' },
]

/* ─── Input field ─────────────────────────────────────────────────── */
function GlassInput({
  id, type = 'text', value, onChange, placeholder, disabled, autoComplete, children,
}: {
  id?: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
  disabled?: boolean; autoComplete?: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-11 px-4 rounded-xl text-[13px] transition-all focus:outline-none disabled:opacity-40"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#f0f6fc',
          caretColor: '#38bdf8',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid rgba(56,189,248,0.5)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        }}
      />
      {children}
    </div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const router             = useRouter()

  const [tab, setTab] = useState<'login' | 'register'>('login')

  /* Login */
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loginErr,     setLoginErr]     = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  /* Register */
  const [rNombre,     setRNombre]    = useState('')
  const [rEmail,      setREmail]     = useState('')
  const [rPass,       setRPass]      = useState('')
  const [rPassConf,   setRPassConf]  = useState('')
  const [showRPass,   setShowRPass]  = useState(false)
  const [regErr,      setRegErr]     = useState<string | null>(null)
  const [regLoading,  setRegLoading] = useState(false)
  const [regSuccess,  setRegSuccess] = useState<'done' | 'confirm' | null>(null)

  const strength = getStrength(rPass)

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email || !password) { setLoginErr('Completa todos los campos.'); return }
    setLoginErr(null); setLoginLoading(true)
    const err = await signIn(email, password)
    setLoginLoading(false)
    if (err) {
      setLoginErr(
        err.toLowerCase().includes('invalid') || err.toLowerCase().includes('credentials')
          ? 'Correo o contraseña incorrectos.'
          : 'Error al iniciar sesión. Intenta de nuevo.'
      )
    } else {
      router.replace('/')
    }
  }

  const handleRegister = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!rNombre || !rEmail || !rPass || !rPassConf) { setRegErr('Completa todos los campos.'); return }
    if (rPass !== rPassConf) { setRegErr('Las contraseñas no coinciden.'); return }
    if (rPass.length < 8)   { setRegErr('La contraseña debe tener al menos 8 caracteres.'); return }
    setRegErr(null); setRegLoading(true)
    const { error, needsConfirm } = await signUp(rEmail, rPass, rNombre)
    setRegLoading(false)
    if (error) {
      setRegErr(error.toLowerCase().includes('already') ? 'Este correo ya tiene una cuenta.' : error)
    } else {
      setRegSuccess(needsConfirm ? 'confirm' : 'done')
    }
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setLoginErr(null); setRegErr(null); setRegSuccess(null)
  }

  return (
    <>
      <style>{`
        /* ── Custom placeholder color ── */
        input::placeholder { color: rgba(148,163,184,0.45); }

        /* ── Animations ── */
        @keyframes floatOrb {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(40px,-30px) scale(1.05); }
          66%      { transform: translate(-25px,20px) scale(0.97); }
        }
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);     opacity: 0 }
          10%  { opacity: 0.8 }
          90%  { opacity: 0.3 }
          100% { transform: translateY(-500px) scale(0.3); opacity: 0 }
        }
        @keyframes tabIn {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes successPop {
          0%   { transform: scale(0.8); opacity: 0 }
          60%  { transform: scale(1.05) }
          100% { transform: scale(1);   opacity: 1 }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);    opacity: 0.6; }
          100% { transform: scale(1.6);  opacity: 0; }
        }
        @keyframes gridScroll {
          from { background-position: 0 0; }
          to   { background-position: 48px 48px; }
        }

        .tab-in    { animation: tabIn 0.28s cubic-bezier(.4,0,.2,1) both; }
        .success-pop { animation: successPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }

        .orb-1 { animation: floatOrb 18s ease-in-out infinite; }
        .orb-2 { animation: floatOrb 24s ease-in-out infinite reverse; }
        .orb-3 { animation: floatOrb 20s ease-in-out infinite 4s; }

        .logo-ring::after {
          content: '';
          position: absolute; inset: -6px;
          border-radius: 50%;
          border: 1px solid rgba(56,189,248,0.3);
          animation: pulseRing 2.5s ease-out infinite;
        }

        .gradient-title {
          background: linear-gradient(135deg, #f0f6fc 30%, #38bdf8 70%, #818cf8 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .grid-scroll {
          animation: gridScroll 8s linear infinite;
        }

        .particle {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(56,189,248,0.5);
          animation: floatUp var(--dur, 10s) ease-in-out infinite var(--delay, 0s);
        }

        /* Glass card divider */
        .divider-glow {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(56,189,248,0.3), rgba(129,140,248,0.3), transparent);
        }
      `}</style>

      {/* ══ FULL PAGE ══ */}
      <div
        className="min-h-screen flex overflow-hidden relative"
        style={{ background: '#020c1b' }}
      >

        {/* ── ANIMATED BG ORBS ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb-1 absolute rounded-full"
            style={{ width: 700, height: 700, top: '-15%', left: '-10%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 65%)' }} />
          <div className="orb-2 absolute rounded-full"
            style={{ width: 600, height: 600, bottom: '-20%', right: '-5%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 65%)' }} />
          <div className="orb-3 absolute rounded-full"
            style={{ width: 400, height: 400, top: '40%', left: '40%',
              background: 'radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 65%)' }} />
        </div>

        {/* Floating particles */}
        {[
          { left: '8%',  bottom: '2%',  '--dur': '12s', '--delay': '0s'   },
          { left: '22%', bottom: '5%',  '--dur': '9s',  '--delay': '2s'   },
          { left: '38%', bottom: '1%',  '--dur': '14s', '--delay': '4s'   },
          { left: '55%', bottom: '8%',  '--dur': '11s', '--delay': '1.5s' },
          { left: '70%', bottom: '3%',  '--dur': '8s',  '--delay': '3s'   },
          { left: '85%', bottom: '6%',  '--dur': '13s', '--delay': '0.8s' },
          { left: '15%', bottom: '25%', '--dur': '16s', '--delay': '5s'   },
          { left: '75%', bottom: '30%', '--dur': '10s', '--delay': '2.5s' },
        ].map((p, i) => (
          <div key={i} className="particle" style={p as React.CSSProperties} />
        ))}

        {/* ══════════════════════════════════════════════════════════════
            LEFT — Branding panel
        ══════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col w-[460px] xl:w-[520px] shrink-0 relative z-10">

          {/* Glass border on right */}
          <div className="absolute top-0 right-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(56,189,248,0.2) 30%, rgba(129,140,248,0.15) 70%, transparent)' }} />

          {/* Scrolling grid overlay */}
          <div className="absolute inset-0 grid-scroll pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }} />

          {/* ── TOP: Logo ── */}
          <div className="relative z-10 px-10 pt-10">
            <div className="flex items-center gap-4">
              <div className="logo-ring relative shrink-0">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-60"
                  style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.8), transparent)' }} />
                <Image
                  src="/logo_empresa.png"
                  alt="SafeLink Monitoring"
                  width={56}
                  height={56}
                  className="relative rounded-full"
                  style={{
                    boxShadow: '0 0 0 2px rgba(56,189,248,0.25), 0 0 24px rgba(37,99,235,0.5)',
                    filter: 'brightness(1.05)',
                  }}
                />
              </div>
              <div>
                <h2 className="text-white font-bold text-[18px] leading-none tracking-[0.02em]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}>
                  SafeLink
                </h2>
                <p className="text-[10px] mt-1 tracking-[0.25em] uppercase"
                  style={{ color: 'rgba(56,189,248,0.6)' }}>
                  Monitoring System
                </p>
              </div>
            </div>
          </div>

          {/* ── CENTER: Hero ── */}
          <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-8">

            {/* Live badge */}
            <div className="inline-flex items-center gap-2 w-fit px-3.5 py-1.5 rounded-full mb-7"
              style={{
                background: 'rgba(37,99,235,0.12)',
                border: '1px solid rgba(37,99,235,0.28)',
                backdropFilter: 'blur(8px)',
              }}>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"
                style={{ boxShadow: '0 0 6px rgba(56,189,248,0.8)' }} />
              <span className="text-blue-300 text-[10px] font-bold tracking-[0.18em] uppercase">
                Sistema activo
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-bold leading-[1.12] mb-5"
              style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(28px,3vw,40px)' }}>
              <span className="text-white">Control total</span><br />
              <span className="gradient-title">de tu equipo</span>
            </h1>

            <p className="text-[13.5px] leading-relaxed mb-8 max-w-[310px]"
              style={{ color: 'rgba(148,163,184,0.65)' }}>
              Plataforma inteligente con reconocimiento facial IA para gestionar asistencias empresariales en tiempo real.
            </p>

            {/* Features */}
            <ul className="space-y-3 mb-10">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-3 group">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105"
                    style={{
                      background: 'rgba(37,99,235,0.1)',
                      border: '1px solid rgba(37,99,235,0.2)',
                      color: '#38bdf8',
                    }}>
                    {f.icon}
                  </div>
                  <span className="text-[13px]" style={{ color: 'rgba(148,163,184,0.7)' }}>{f.label}</span>
                </li>
              ))}
            </ul>

            {/* Divider */}
            <div className="divider-glow mb-8" />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {STATS.map((s) => (
                <div key={s.val}
                  className="rounded-2xl p-4 text-center transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(8px)',
                  }}>
                  <p className="font-bold text-[22px] leading-none" style={{ color: s.color, fontFamily: 'Poppins, sans-serif' }}>
                    {s.val}
                  </p>
                  <p className="text-[10px] mt-2 leading-tight" style={{ color: 'rgba(148,163,184,0.45)' }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div className="relative z-10 px-10 pb-8">
            <p className="text-[11px]" style={{ color: 'rgba(148,163,184,0.3)' }}>
              © {new Date().getFullYear()} SafeLink Monitoring · Todos los derechos reservados
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT — Form panel (glassmorphism)
        ══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex items-center justify-center relative z-10 px-6 py-12">

          {/* Mobile logo */}
          <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
            <Image src="/logo_empresa.png" alt="SafeLink" width={32} height={32} className="rounded-full"
              style={{ boxShadow: '0 0 16px rgba(37,99,235,0.5)' }} />
            <div>
              <p className="font-bold text-[14px] leading-none text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>SafeLink</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(56,189,248,0.6)' }}>Monitoring</p>
            </div>
          </div>

          <div className="w-full max-w-[400px]">

            {/* ── Heading ── */}
            <div className="mb-7 text-center">
              {/* Secure badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold mb-5"
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#22c55e',
                  backdropFilter: 'blur(8px)',
                }}>
                <Lock size={10} />
                Acceso seguro y cifrado
              </div>

              <h2 className="font-bold leading-tight text-white"
                style={{ fontFamily: 'Poppins, sans-serif', fontSize: '26px' }}>
                {tab === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
              </h2>
              <p className="text-[13px] mt-2" style={{ color: 'rgba(148,163,184,0.55)' }}>
                {tab === 'login' ? 'Ingresa con tu cuenta corporativa' : 'Completa los datos para registrarte'}
              </p>
            </div>

            {/* ── Tab switcher ── */}
            <div className="flex rounded-2xl p-1 mb-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
              }}>
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-semibold cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  style={{
                    background: tab === t
                      ? 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                      : 'transparent',
                    color:     tab === t ? '#fff' : 'rgba(148,163,184,0.6)',
                    boxShadow: tab === t ? '0 2px 16px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                  }}>
                  {t === 'login'
                    ? <><Lock size={11} /> Iniciar sesión</>
                    : <><UserPlus size={11} /> Crear cuenta</>}
                </button>
              ))}
            </div>

            {/* ── Glass card ── */}
            <div className="rounded-3xl p-7"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}>

              {/* ── LOGIN ── */}
              {tab === 'login' && (
                <form key="login" className="tab-in space-y-5" onSubmit={handleLogin} noValidate>

                  <div className="space-y-2">
                    <label htmlFor="login-email" className="block text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: 'rgba(148,163,184,0.6)' }}>
                      Correo electrónico
                    </label>
                    <GlassInput
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(v) => { setEmail(v); setLoginErr(null) }}
                      placeholder="usuario@empresa.com"
                      disabled={loginLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="login-pass" className="block text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: 'rgba(148,163,184,0.6)' }}>
                      Contraseña
                    </label>
                    <GlassInput
                      id="login-pass"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(v) => { setPassword(v); setLoginErr(null) }}
                      placeholder="••••••••••"
                      disabled={loginLoading}
                    >
                      <button type="button" onClick={() => setShowPass((v) => !v)} tabIndex={-1}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer focus:outline-none transition-colors"
                        style={{ color: 'rgba(148,163,184,0.4)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(148,163,184,0.4)'}>
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </GlassInput>
                  </div>

                  {loginErr && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
                      role="alert">
                      <AlertCircle size={13} className="shrink-0" />
                      {loginErr}
                    </div>
                  )}

                  <button type="submit" disabled={loginLoading}
                    className="w-full h-12 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed group"
                    style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                      boxShadow: '0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                    onMouseEnter={(e) => !loginLoading && (e.currentTarget.style.boxShadow = '0 6px 32px rgba(37,99,235,0.6), inset 0 1px 0 rgba(255,255,255,0.18)')}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.18)')}>
                    {loginLoading
                      ? <><Spinner /> Verificando…</>
                      : <>Entrar al dashboard <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>}
                  </button>

                  <p className="text-center text-[12px]" style={{ color: 'rgba(148,163,184,0.45)' }}>
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => switchTab('register')}
                      className="font-semibold cursor-pointer transition-colors focus:outline-none"
                      style={{ color: '#38bdf8' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#7dd3fc'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#38bdf8'}>
                      Regístrate aquí
                    </button>
                  </p>
                </form>
              )}

              {/* ── REGISTER ── */}
              {tab === 'register' && (
                <div key="register" className="tab-in">
                  {regSuccess ? (
                    <div className="success-pop flex flex-col items-center text-center py-4 gap-5">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 0 40px rgba(34,197,94,0.15)' }}>
                          <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-[18px] text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          {regSuccess === 'confirm' ? '¡Revisa tu correo!' : '¡Cuenta creada!'}
                        </h3>
                        <p className="text-[13px] mt-2.5 leading-relaxed max-w-[280px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
                          {regSuccess === 'confirm'
                            ? 'Te enviamos un enlace de confirmación. Verifica tu bandeja de entrada para activar tu cuenta.'
                            : 'Tu cuenta fue creada exitosamente. Ya puedes iniciar sesión.'}
                        </p>
                      </div>
                      <button onClick={() => { setTab('login'); setRegSuccess(null) }}
                        className="h-10 px-8 rounded-xl text-[13px] font-bold text-white cursor-pointer transition-all focus:outline-none"
                        style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>
                        Iniciar sesión
                      </button>
                    </div>
                  ) : (
                    <form className="space-y-4" onSubmit={handleRegister} noValidate>

                      {/* Nombre */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: 'rgba(148,163,184,0.6)' }}>Nombre completo</label>
                        <GlassInput type="text" autoComplete="name" value={rNombre}
                          onChange={(v) => { setRNombre(v); setRegErr(null) }}
                          placeholder="Juan García" disabled={regLoading} />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: 'rgba(148,163,184,0.6)' }}>Correo electrónico</label>
                        <GlassInput type="email" autoComplete="email" value={rEmail}
                          onChange={(v) => { setREmail(v); setRegErr(null) }}
                          placeholder="usuario@empresa.com" disabled={regLoading} />
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: 'rgba(148,163,184,0.6)' }}>Contraseña</label>
                        <GlassInput type={showRPass ? 'text' : 'password'} autoComplete="new-password"
                          value={rPass} onChange={(v) => { setRPass(v); setRegErr(null) }}
                          placeholder="Mín. 8 caracteres" disabled={regLoading}>
                          <button type="button" onClick={() => setShowRPass((v) => !v)} tabIndex={-1}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer focus:outline-none transition-colors"
                            style={{ color: 'rgba(148,163,184,0.4)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(148,163,184,0.4)'}>
                            {showRPass ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </GlassInput>

                        {/* Strength meter */}
                        {rPass && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map((n) => (
                                <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
                                  style={{ background: n <= strength.score ? strength.color : 'rgba(255,255,255,0.07)' }} />
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                              <div className="flex items-center gap-2 text-[10px]">
                                {[
                                  { ok: rPass.length >= 8,          label: '8+' },
                                  { ok: /[A-Z]/.test(rPass),        label: 'A-Z' },
                                  { ok: /[0-9]/.test(rPass),        label: '0-9' },
                                  { ok: /[^A-Za-z0-9]/.test(rPass), label: '#@' },
                                ].map((r) => (
                                  <span key={r.label} className="flex items-center gap-0.5"
                                    style={{ color: r.ok ? '#22c55e' : 'rgba(148,163,184,0.35)' }}>
                                    <Check size={9} />{r.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirm password */}
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold uppercase tracking-widest"
                          style={{ color: 'rgba(148,163,184,0.6)' }}>Confirmar contraseña</label>
                        <GlassInput type="password" autoComplete="new-password"
                          value={rPassConf} onChange={(v) => { setRPassConf(v); setRegErr(null) }}
                          placeholder="••••••••••" disabled={regLoading} />
                        {rPassConf && rPass !== rPassConf && (
                          <p className="text-[11px]" style={{ color: '#f87171' }}>Las contraseñas no coinciden</p>
                        )}
                      </div>

                      {regErr && (
                        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
                          role="alert">
                          <AlertCircle size={13} className="shrink-0" />
                          {regErr}
                        </div>
                      )}

                      <button type="submit" disabled={regLoading}
                        className="w-full h-12 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed group"
                        style={{
                          background: 'linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%)',
                          boxShadow: '0 4px 24px rgba(37,99,235,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                        }}>
                        {regLoading
                          ? <><Spinner /> Creando cuenta…</>
                          : <>Crear mi cuenta <UserPlus size={14} className="group-hover:scale-110 transition-transform" /></>}
                      </button>

                      <p className="text-center text-[12px]" style={{ color: 'rgba(148,163,184,0.45)' }}>
                        ¿Ya tienes cuenta?{' '}
                        <button type="button" onClick={() => switchTab('login')}
                          className="font-semibold cursor-pointer transition-colors focus:outline-none"
                          style={{ color: '#38bdf8' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#7dd3fc'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#38bdf8'}>
                          Inicia sesión
                        </button>
                      </p>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* ── Trust badges ── */}
            <div className="flex items-center justify-center gap-5 mt-5">
              {[
                { icon: <KeyRound size={10} />,    label: 'SSL 256-bit' },
                { icon: <ShieldCheck size={10} />, label: 'Datos cifrados' },
                { icon: <BadgeCheck size={10} />,  label: 'GDPR' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: 'rgba(148,163,184,0.3)' }}>
                  {b.icon}
                  {b.label}
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] mt-2" style={{ color: 'rgba(148,163,184,0.2)' }}>
              Acceso restringido a personal autorizado
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
