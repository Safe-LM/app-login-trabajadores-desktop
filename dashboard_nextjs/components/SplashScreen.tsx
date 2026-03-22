'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'visible' | 'fading'>('visible')

  useEffect(() => {
    // Fase 1: mostrar splash 1.8s
    const t1 = setTimeout(() => setPhase('fading'), 1800)
    // Fase 2: después del fade (300ms) avisar al padre
    const t2 = setTimeout(() => onDone(), 2100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: 'var(--bg-base)',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.3s ease',
        pointerEvents: phase === 'fading' ? 'none' : 'all',
      }}
    >
      {/* Logo */}
      <div
        className="flex flex-col items-center gap-5"
        style={{ animation: 'logoRise 0.6s ease both' }}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, var(--accent-2), var(--accent))',
            boxShadow: '0 0 60px rgba(58,134,255,0.35)',
          }}
        >
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Name */}
        <div className="text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Safe Link
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            Sistema de Asistencias
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-48 h-[3px] rounded-full overflow-hidden mt-2"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--accent-2), var(--accent))',
              animation: 'barLoad 1.6s cubic-bezier(0.4,0,0.2,1) both',
            }}
          />
        </div>

        <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          Cargando datos…
        </p>
      </div>
    </div>
  )
}
