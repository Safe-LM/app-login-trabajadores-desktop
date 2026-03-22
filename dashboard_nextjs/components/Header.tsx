'use client'

import { useEffect, useState } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import type { Filters } from '@/lib/types'
import { RefreshCw, SlidersHorizontal, X, Sun, Moon, LogOut } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'
import { useAuth } from '@/lib/auth-context'

interface Props {
  filters: Filters
  onFiltersChange: (f: Filters) => void
  sucursales: string[]
  connected: boolean | null
  onRefresh: () => void
  onExport: () => void
  refreshing: boolean
}

const today = () => format(new Date(), 'yyyy-MM-dd')

const PRESETS = [
  { label: 'Hoy', get: () => ({ desde: today(), hasta: today() }) },
  {
    label: '7 días',
    get: () => ({ desde: format(subDays(new Date(), 6), 'yyyy-MM-dd'), hasta: today() }),
  },
  {
    label: '30 días',
    get: () => ({ desde: format(subDays(new Date(), 29), 'yyyy-MM-dd'), hasta: today() }),
  },
  {
    label: 'Este mes',
    get: () => ({ desde: format(startOfMonth(new Date()), 'yyyy-MM-dd'), hasta: today() }),
  },
]

function activePreset(filters: Filters) {
  for (const p of PRESETS) {
    const g = p.get()
    if (g.desde === filters.desde && g.hasta === filters.hasta) return p.label
  }
  return null
}

export default function Header({
  filters,
  onFiltersChange,
  sucursales,
  connected,
  onRefresh,
  onExport,
  refreshing,
}: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const [clock, setClock] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('es-MX', { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const set = (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onFiltersChange({ ...filters, [key]: e.target.value })

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    const { desde, hasta } = preset.get()
    onFiltersChange({ ...filters, desde, hasta })
  }

  const currentPreset = activePreset(filters)

  return (
    <>
      {/* ── Main bar ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: 'var(--bg-header)', backdropFilter: 'blur(20px)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 flex items-center gap-3">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#00d2ff,#3a86ff)' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="hidden sm:block">
              <p className="heading text-[13px] font-bold leading-none tracking-wide" style={{ color: 'var(--text-primary)' }}>
                SAFE LINK
              </p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text-dim)' }}>Asistencias</p>
            </div>
          </div>

          {/* Preset buttons — desktop */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2"
                style={{
                  background: currentPreset === p.label ? 'var(--accent)' : 'transparent',
                  color: currentPreset === p.label ? '#fff' : 'var(--text-dim)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Desktop filters */}
          <div className="hidden lg:flex items-center gap-2 flex-1 ml-1">
            <input
              type="date"
              value={filters.desde}
              onChange={set('desde')}
              className="filter-input rounded-lg px-2.5 py-1.5 text-[12px] h-8 w-36 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            />
            <span className="text-[11px] text-[#484f58]">→</span>
            <input
              type="date"
              value={filters.hasta}
              onChange={set('hasta')}
              className="filter-input rounded-lg px-2.5 py-1.5 text-[12px] h-8 w-36 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            />
            <select
              value={filters.sucursal}
              onChange={set('sucursal')}
              className="filter-input rounded-lg px-2.5 py-1.5 text-[12px] h-8 min-w-[130px] cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.tipo}
              onChange={set('tipo')}
              className="filter-input rounded-lg px-2.5 py-1.5 text-[12px] h-8 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            >
              <option value="">Entrada y Salida</option>
              <option value="entrada">Solo Entrada</option>
              <option value="salida">Solo Salida</option>
            </select>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Mobile: filter toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer
                focus:outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              aria-label="Abrir filtros"
            >
              {filtersOpen ? <X size={14} /> : <SlidersHorizontal size={14} />}
            </button>

            {/* Connection */}
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  background: connected === null ? 'var(--text-muted)' : connected ? 'var(--success)' : 'var(--danger)',
                  boxShadow: connected ? '0 0 6px rgba(34,197,94,0.5)' : undefined,
                  animation: connected ? 'pulse 2s infinite' : undefined,
                }}
              />
              <span className="hidden sm:block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {connected === null ? 'Conectando' : connected ? 'En vivo' : 'Sin conexión'}
              </span>
            </div>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              title="Actualizar datos"
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer
                disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onExport}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium
                border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" />
              </svg>
              CSV
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* User + logout */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-right hidden md:block">
                  <p className="text-[11px] font-medium leading-none" style={{ color: 'var(--text-primary)' }}>
                    {user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Admin</p>
                </div>
                <button
                  onClick={signOut}
                  title="Cerrar sesión"
                  className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-[#ef4444]/40 hover:border-red-500/40 hover:text-red-400"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}

            <span className="mono text-[12px] hidden md:block w-16 text-right" style={{ color: 'var(--text-dim)' }}>
              {clock}
            </span>
          </div>
        </div>
      </header>

      {/* ── Mobile filter panel ── */}
      {filtersOpen && (
        <div
          className="lg:hidden sticky top-14 z-40 border-b px-4 py-3 space-y-2"
          style={{ background: 'var(--bg-header)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}
        >
          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { applyPreset(p); setFiltersOpen(false) }}
                className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2"
                style={{
                  background: currentPreset === p.label ? 'var(--accent)' : 'var(--border)',
                  color: currentPreset === p.label ? '#fff' : 'var(--text-dim)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium" style={{ color: 'var(--text-dim)' }}>Desde</label>
              <input
                type="date"
                value={filters.desde}
                onChange={set('desde')}
                className="filter-input rounded-lg px-3 py-1.5 text-[12px] h-8 w-full cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#8b949e] font-medium">Hasta</label>
              <input
                type="date"
                value={filters.hasta}
                onChange={set('hasta')}
                className="filter-input rounded-lg px-3 py-1.5 text-[12px] h-8 w-full cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
              />
            </div>
            <select
              value={filters.sucursal}
              onChange={set('sucursal')}
              className="filter-input rounded-lg px-3 py-1.5 text-[12px] h-8 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filters.tipo}
              onChange={set('tipo')}
              className="filter-input rounded-lg px-3 py-1.5 text-[12px] h-8 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-[#3a86ff]/50"
            >
              <option value="">Entrada y Salida</option>
              <option value="entrada">Solo Entrada</option>
              <option value="salida">Solo Salida</option>
            </select>
          </div>
        </div>
      )}
    </>
  )
}
