'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  sub: string
  color: string
  icon: React.ReactNode
  loading?: boolean
  delta?: number | null
  currentVal?: number
}

function DeltaBadge({ delta, currentVal }: { delta: number; currentVal: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <Minus size={10} /> Sin cambio
      </span>
    )
  }
  const pct = delta > 0 ? ((currentVal - delta) / delta) * 100 : 0
  const up  = currentVal >= delta
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold"
      style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{pct.toFixed(0)}% vs período ant.
    </span>
  )
}

export default function KpiCard({ label, value, sub, color, icon, loading, delta, currentVal }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 group cursor-default"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = color + '55'
        el.style.boxShadow   = `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px ${color}22`
        el.style.background  = 'var(--bg-card-hover)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow   = 'none'
        el.style.background  = 'var(--bg-card)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-dim)', fontFamily: "'Open Sans', sans-serif" }}
        >
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <>
          <div className="skeleton h-9 rounded-lg w-24 mb-2" />
          <div className="skeleton h-3 rounded w-32 mt-3" />
        </>
      ) : (
        <>
          <p
            className="text-[2.1rem] font-bold leading-none tracking-tight"
            style={{ color, fontFamily: "'Poppins', system-ui, sans-serif" }}
          >
            {value}
          </p>
          <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          {delta != null && currentVal != null && (
            <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <DeltaBadge delta={delta} currentVal={currentVal} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
