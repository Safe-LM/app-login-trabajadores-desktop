'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Eye, EyeOff, Shield, Sun, Moon, Lock,
  Users, BarChart3, Wifi, ArrowRight, UserPlus,
  CheckCircle2, AlertCircle, Check, ShieldCheck, KeyRound, BadgeCheck
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'

/* ─── Password strength ─────────────────────────────────────────────── */
function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '#374151' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Débil',    color: '#ef4444' }
  if (score <= 2) return { score, label: 'Regular',  color: '#f59e0b' }
  if (score <= 3) return { score, label: 'Buena',    color: '#3b82f6' }
  return              { score, label: 'Fuerte',   color: '#22c55e' }
}

/* ─── Static data ───────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Users size={15} />,     label: 'Control de asistencias en tiempo real' },
  { icon: <BarChart3 size={15} />, label: 'Analítica por sucursal y período' },
  { icon: <Shield size={15} />,    label: 'Reconocimiento facial con IA' },
  { icon: <Wifi size={15} />,      label: 'Sincronización automática en la nube' },
]

const STATS = [
  { val: '99%',  label: 'Precisión IA',     color: '#22c55e' },
  { val: '<1s',  label: 'Tiempo respuesta', color: '#38bdf8' },
  { val: '24/7', label: 'Disponibilidad',   color: '#f59e0b' },
]

/* ─── Floating particle (CSS-only via inline keyframes) ─────────────── */
function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 4, height: 4,
        background: 'rgba(56,189,248,0.35)',
        animation: 'floatUp 8s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const { theme, toggle }  = useTheme()
  const router             = useRouter()
  const isDark             = theme === 'dark'

  /* Tab */
  const [tab, setTab] = useState<'login' | 'register'>('login')

  /* Login fields */
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loginErr, setLoginErr] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  /* Register fields */
  const [rNombre,   setRNombre]   = useState('')
  const [rEmail,    setREmail]    = useState('')
  const [rPass,     setRPass]     = useState('')
  const [rPassConf, setRPassConf] = useState('')
  const [showRPass, setShowRPass] = useState(false)
  const [regErr,    setRegErr]    = useState<string | null>(null)
  const [regLoading, setRegLoading] = useState(false)
  const [regSuccess, setRegSuccess] = useState<'done' | 'confirm' | null>(null)

  const strength = getStrength(rPass)

  /* ── Login submit ── */
  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!email || !password) { setLoginErr('Completa todos los campos.'); return }
    setLoginErr(null)
    setLoginLoading(true)
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

  /* ── Register submit ── */
  const handleRegister = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!rNombre || !rEmail || !rPass || !rPassConf) {
      setRegErr('Completa todos los campos.'); return
    }
    if (rPass !== rPassConf) {
      setRegErr('Las contraseñas no coinciden.'); return
    }
    if (rPass.length < 8) {
      setRegErr('La contraseña debe tener al menos 8 caracteres.'); return
    }
    setRegErr(null)
    setRegLoading(true)
    const { error, needsConfirm } = await signUp(rEmail, rPass, rNombre)
    setRegLoading(false)
    if (error) {
      setRegErr(
        error.toLowerCase().includes('already')
          ? 'Este correo ya tiene una cuenta.'
          : error
      )
    } else {
      setRegSuccess(needsConfirm ? 'confirm' : 'done')
    }
  }

  return (
    <>
      {/* Inject particle keyframe once */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1);   opacity: 0 }
          10%  { opacity: 1 }
          90%  { opacity: 0.6 }
          100% { transform: translateY(-420px) scale(0.4); opacity: 0 }
        }
        @keyframes tabSlide {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .tab-panel { animation: tabSlide 0.25s ease both }
        @keyframes successPop {
          0%   { transform: scale(0.85); opacity: 0 }
          60%  { transform: scale(1.04) }
          100% { transform: scale(1);   opacity: 1 }
        }
        .success-pop { animation: successPop 0.4s ease both }
      `}</style>

      <div className="min-h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>

        {/* ══════════════════════════════════════════════════════════════
            LEFT — Branding panel
        ══════════════════════════════════════════════════════════════ */}
        <div
          className="hidden lg:flex flex-col w-[500px] shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #040d1f 0%, #071428 45%, #050e20 100%)' }}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.20) 0%, transparent 70%)' }} />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.13) 0%, transparent 70%)' }} />
            <div className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(rgba(37,99,235,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.06) 1px,transparent 1px)',
                backgroundSize: '48px 48px',
              }} />
          </div>

          {/* Floating particles */}
          {[
            { left: '15%',  bottom: '5%',  animationDelay: '0s',   animationDuration: '9s'  },
            { left: '40%',  bottom: '8%',  animationDelay: '2.5s', animationDuration: '11s' },
            { left: '65%',  bottom: '3%',  animationDelay: '1s',   animationDuration: '8s'  },
            { left: '80%',  bottom: '10%', animationDelay: '4s',   animationDuration: '12s' },
            { left: '28%',  bottom: '15%', animationDelay: '3.2s', animationDuration: '10s' },
            { left: '55%',  bottom: '20%', animationDelay: '0.8s', animationDuration: '7s'  },
          ].map((p, i) => <Particle key={i} style={p} />)}

          {/* ── TOP: Logo + brand ── */}
          <div className="relative z-10 px-10 pt-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl opacity-40"
                  style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }} />
                <Image
                  src="/logo_empresa.png"
                  alt="SafeLink Monitoring"
                  width={60}
                  height={60}
                  className="relative rounded-full ring-2 ring-blue-500/30 ring-offset-2 ring-offset-transparent"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(37,99,235,0.55))' }}
                />
              </div>
              <div>
                <h2 className="heading text-white font-bold text-[18px] leading-none tracking-wide">SafeLink</h2>
                <p className="text-blue-400/70 text-[11px] mt-0.5 tracking-widest uppercase">Monitoring System</p>
              </div>
            </div>
          </div>

          {/* ── CENTER: Hero copy ── */}
          <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-[11px] font-semibold tracking-wider uppercase">
                Sistema activo
              </span>
            </div>

            <h1 className="heading text-white font-bold leading-[1.15] mb-4" style={{ fontSize: 'clamp(26px, 2.8vw, 36px)' }}>
              Control total<br />
              <span style={{ backgroundImage: 'linear-gradient(90deg,#38bdf8,#2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                de tu equipo
              </span>
            </h1>
            <p className="text-blue-200/50 text-[13.5px] leading-relaxed mb-8 max-w-[320px]">
              Plataforma inteligente con reconocimiento facial IA para gestionar asistencias empresariales en tiempo real.
            </p>

            {/* Features */}
            <ul className="space-y-3.5 mb-10">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)', color: '#38bdf8' }}>
                    {f.icon}
                  </div>
                  <span className="text-[13px] text-blue-100/70">{f.label}</span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {STATS.map((s) => (
                <div key={s.val} className="rounded-2xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="font-bold text-[20px] leading-none" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-blue-300/50 text-[10px] mt-1.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM footer ── */}
          <div className="relative z-10 px-10 pb-8">
            <div className="h-px mb-5" style={{ background: 'linear-gradient(90deg,transparent,rgba(37,99,235,0.3),transparent)' }} />
            <p className="text-blue-300/35 text-[11px]">
              © {new Date().getFullYear()} SafeLink Monitoring · Todos los derechos reservados
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT — Form panel
        ══════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-screen">

          {/* Top bar */}
          <div className="flex items-center justify-between px-8 py-5">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3">
              <Image src="/logo_empresa.png" alt="SafeLink" width={34} height={34} className="rounded-full" />
              <div>
                <p className="font-bold text-[14px] leading-none" style={{ color: 'var(--text-primary)' }}>SafeLink</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>Monitoring</p>
              </div>
            </div>
            <div className="hidden lg:block" />

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer transition-all focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--text-dim)' }}
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          {/* Center form */}
          <div className="flex-1 flex items-center justify-center px-6 pb-12">
            <div className="w-full max-w-[420px]">

              {/* Heading */}
              <div className="mb-7 text-center">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold mb-4"
                  style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.18)' }}>
                  <Lock size={11} />
                  Acceso seguro y cifrado
                </div>
                <h2 className="heading text-[26px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {tab === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                </h2>
                <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-dim)' }}>
                  {tab === 'login' ? 'Ingresa con tu cuenta corporativa' : 'Completa los datos para registrarte'}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-xl p-1 mb-6"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                {(['login', 'register'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t)
                      setLoginErr(null); setRegErr(null); setRegSuccess(null)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-[12px] font-semibold cursor-pointer transition-all focus:outline-none"
                    style={{
                      background: tab === t ? 'linear-gradient(135deg,#0ea5e9,#2563eb)' : 'transparent',
                      color:      tab === t ? '#fff' : 'var(--text-dim)',
                      boxShadow:  tab === t ? '0 2px 12px rgba(37,99,235,0.35)' : 'none',
                    }}
                  >
                    {t === 'login' ? <><Lock size={12} /> Iniciar sesión</> : <><UserPlus size={12} /> Crear cuenta</>}
                  </button>
                ))}
              </div>

              {/* Card */}
              <div className="rounded-2xl p-7"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: isDark
                    ? '0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.4)'
                    : '0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)',
                }}>

                {/* ── LOGIN FORM ── */}
                {tab === 'login' && (
                  <form key="login" className="tab-panel space-y-5" onSubmit={handleLogin} noValidate>

                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                        Correo electrónico
                      </label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setLoginErr(null) }}
                        placeholder="usuario@empresa.com"
                        disabled={loginLoading}
                        className="w-full h-11 px-4 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPass ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setLoginErr(null) }}
                          placeholder="••••••••••"
                          disabled={loginLoading}
                          className="w-full h-11 px-4 pr-11 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                          style={{ color: 'var(--text-primary)' }}
                        />
                        <button type="button" onClick={() => setShowPass((v) => !v)} tabIndex={-1}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
                          style={{ color: 'var(--text-muted)' }}>
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {loginErr && (
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                        <AlertCircle size={13} className="shrink-0" />
                        {loginErr}
                      </div>
                    )}

                    <button type="submit" disabled={loginLoading}
                      className="w-full h-12 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2.5 cursor-pointer transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed group mt-1"
                      style={{
                        background: 'linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%)',
                        boxShadow: isDark ? '0 4px 24px rgba(37,99,235,0.4),inset 0 1px 0 rgba(255,255,255,0.15)' : '0 4px 16px rgba(37,99,235,0.3)',
                      }}>
                      {loginLoading ? (
                        <>
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Verificando…
                        </>
                      ) : (
                        <>
                          Entrar al dashboard
                          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>

                    <p className="text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      ¿No tienes cuenta?{' '}
                      <button type="button" onClick={() => setTab('register')}
                        className="font-semibold cursor-pointer hover:underline focus:outline-none"
                        style={{ color: 'var(--accent)' }}>
                        Regístrate aquí
                      </button>
                    </p>
                  </form>
                )}

                {/* ── REGISTER FORM ── */}
                {tab === 'register' && (
                  <div key="register" className="tab-panel">
                    {regSuccess ? (
                      /* Success state */
                      <div className="success-pop flex flex-col items-center text-center py-4 gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                          <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
                        </div>
                        <div>
                          <h3 className="font-bold text-[17px]" style={{ color: 'var(--text-primary)' }}>
                            {regSuccess === 'confirm' ? '¡Revisa tu correo!' : '¡Cuenta creada!'}
                          </h3>
                          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                            {regSuccess === 'confirm'
                              ? 'Te enviamos un enlace de confirmación. Verifica tu bandeja de entrada para activar tu cuenta.'
                              : 'Tu cuenta fue creada exitosamente. Ya puedes iniciar sesión.'}
                          </p>
                        </div>
                        <button onClick={() => { setTab('login'); setRegSuccess(null) }}
                          className="h-10 px-6 rounded-xl text-[13px] font-bold text-white cursor-pointer transition-all focus:outline-none"
                          style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)' }}>
                          Iniciar sesión
                        </button>
                      </div>
                    ) : (
                      <form className="space-y-4" onSubmit={handleRegister} noValidate>

                        {/* Nombre */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                            Nombre completo
                          </label>
                          <input
                            type="text"
                            autoComplete="name"
                            value={rNombre}
                            onChange={(e) => { setRNombre(e.target.value); setRegErr(null) }}
                            placeholder="Juan García"
                            disabled={regLoading}
                            className="w-full h-11 px-4 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                            Correo electrónico
                          </label>
                          <input
                            type="email"
                            autoComplete="email"
                            value={rEmail}
                            onChange={(e) => { setREmail(e.target.value); setRegErr(null) }}
                            placeholder="usuario@empresa.com"
                            disabled={regLoading}
                            className="w-full h-11 px-4 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                            Contraseña
                          </label>
                          <div className="relative">
                            <input
                              type={showRPass ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={rPass}
                              onChange={(e) => { setRPass(e.target.value); setRegErr(null) }}
                              placeholder="Mín. 8 caracteres"
                              disabled={regLoading}
                              className="w-full h-11 px-4 pr-11 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                              style={{ color: 'var(--text-primary)' }}
                            />
                            <button type="button" onClick={() => setShowRPass((v) => !v)} tabIndex={-1}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer focus:outline-none"
                              style={{ color: 'var(--text-muted)' }}>
                              {showRPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          {/* Strength meter */}
                          {rPass && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <div key={n} className="flex-1 h-1 rounded-full transition-all duration-300"
                                    style={{ background: n <= strength.score ? strength.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }} />
                                ))}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold" style={{ color: strength.color }}>
                                  {strength.label}
                                </span>
                                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  {[
                                    { ok: rPass.length >= 8,        label: '8+ chars' },
                                    { ok: /[A-Z]/.test(rPass),      label: 'Mayúsc.' },
                                    { ok: /[0-9]/.test(rPass),      label: 'Número' },
                                    { ok: /[^A-Za-z0-9]/.test(rPass), label: 'Símbolo' },
                                  ].map((r) => (
                                    <span key={r.label} className="flex items-center gap-0.5" style={{ color: r.ok ? '#22c55e' : 'var(--text-muted)' }}>
                                      <Check size={9} />
                                      {r.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
                            Confirmar contraseña
                          </label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={rPassConf}
                            onChange={(e) => { setRPassConf(e.target.value); setRegErr(null) }}
                            placeholder="••••••••••"
                            disabled={regLoading}
                            className="w-full h-11 px-4 rounded-xl text-[13px] filter-input focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                            style={{
                              color: 'var(--text-primary)',
                              borderColor: rPassConf && rPass !== rPassConf ? 'rgba(239,68,68,0.5)' : undefined,
                            }}
                          />
                          {rPassConf && rPass !== rPassConf && (
                            <p className="text-[11px]" style={{ color: 'var(--danger)' }}>Las contraseñas no coinciden</p>
                          )}
                        </div>

                        {regErr && (
                          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[12px]"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                            <AlertCircle size={13} className="shrink-0" />
                            {regErr}
                          </div>
                        )}

                        <button type="submit" disabled={regLoading}
                          className="w-full h-12 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2.5 cursor-pointer transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed group mt-1"
                          style={{
                            background: 'linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%)',
                            boxShadow: isDark ? '0 4px 24px rgba(37,99,235,0.4),inset 0 1px 0 rgba(255,255,255,0.15)' : '0 4px 16px rgba(37,99,235,0.3)',
                          }}>
                          {regLoading ? (
                            <>
                              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                              Creando cuenta…
                            </>
                          ) : (
                            <>
                              Crear mi cuenta
                              <UserPlus size={15} />
                            </>
                          )}
                        </button>

                        <p className="text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          ¿Ya tienes cuenta?{' '}
                          <button type="button" onClick={() => setTab('login')}
                            className="font-semibold cursor-pointer hover:underline focus:outline-none"
                            style={{ color: 'var(--accent)' }}>
                            Inicia sesión
                          </button>
                        </p>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-5 mt-5">
                {([
                  { icon: <KeyRound size={11} />,    label: 'SSL 256-bit' },
                  { icon: <ShieldCheck size={11} />, label: 'Datos cifrados' },
                  { icon: <BadgeCheck size={11} />,  label: 'GDPR' },
                ] as { icon: React.ReactNode; label: string }[]).map((b) => (
                  <div key={b.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {b.icon}
                    {b.label}
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                Acceso restringido a personal autorizado
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
