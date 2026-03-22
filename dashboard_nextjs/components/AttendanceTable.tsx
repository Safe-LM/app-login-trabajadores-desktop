'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'
import type { AsistenciaDetalle, SortCol } from '@/lib/types'

interface Props {
  data: AsistenciaDetalle[]
  count: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  search: string
  onSearchChange: (v: string) => void
  loading: boolean
  onExport: () => void
  sortCol: SortCol
  sortAsc: boolean
  onSort: (col: SortCol) => void
}

const COLUMNS: { key: SortCol; label: string; align?: string }[] = [
  { key: 'nombre_empleado',      label: 'Empleado' },
  { key: 'sucursal',             label: 'Sucursal' },
  { key: 'tipo',                 label: 'Tipo' },
  { key: 'registrado_en',        label: 'Hora' },
  { key: 'confianza_pct',        label: 'Confianza', align: 'right' },
  { key: 'clasificacion_retardo',label: 'Puntualidad' },
  { key: 'minutos_retardo',      label: 'Retardo', align: 'right' },
]

function SortIcon({ col, sortCol, sortAsc }: { col: SortCol; sortCol: SortCol; sortAsc: boolean }) {
  if (col !== sortCol) return <ChevronsUpDown size={11} style={{ color: 'var(--text-muted)' }} className="ml-1 shrink-0" />
  return sortAsc
    ? <ChevronUp   size={11} style={{ color: 'var(--accent)' }} className="ml-1 shrink-0" />
    : <ChevronDown size={11} style={{ color: 'var(--accent)' }} className="ml-1 shrink-0" />
}

function ConfidenceBar({ value }: { value: number }) {
  const pct   = Math.round(value ?? 0)
  const color = pct >= 90 ? 'var(--success)' : pct >= 75 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mono text-[12px] w-8 text-right tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

function PuntualidadBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">—</span>
  const v = value.toLowerCase()
  const cls =
    v.includes('tiempo') || v.includes('puntual') ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25'
    : v.includes('leve')     ? 'bg-amber-400/15 text-amber-500 border-amber-400/25'
    : v.includes('moderado') ? 'bg-orange-500/15 text-orange-500 border-orange-500/25'
    :                          'bg-red-500/15 text-red-500 border-red-500/25'
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {value}
    </span>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
          {COLUMNS.map((c) => (
            <td key={c.key} className="px-4 py-3">
              <div className="skeleton h-3.5 rounded" style={{ width: `${50 + (i * 13 + c.key.length * 7) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Avatar({ name }: { name: string }) {
  const hue = (name?.charCodeAt(0) ?? 65) * 137 % 360
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
      style={{ background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,25%)` }}
    >
      {(name ?? '?').slice(0, 2).toUpperCase()}
    </div>
  )
}

// ─── Pagination button ─────────────────────────────────────────────────────────
function PagBtn({
  onClick, disabled, active, children,
}: {
  onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[28px] h-7 px-1.5 rounded text-[11px] font-medium transition-all cursor-pointer
        disabled:opacity-30 focus:outline-none focus:ring-2"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-dim)',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--border)' }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

export default function AttendanceTable({
  data, count, page, pageSize, onPageChange,
  search, onSearchChange, loading, onExport,
  sortCol, sortAsc, onSort,
}: Props) {
  const totalPages  = Math.max(1, Math.ceil(count / pageSize))
  const from        = page * pageSize + 1
  const to          = Math.min((page + 1) * pageSize, count)
  const windowStart = Math.max(0, Math.min(page - 2, totalPages - 5))
  const pageNums    = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i)

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

      {/* ── Table header ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Detalle de Registros
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {loading
              ? 'Cargando...'
              : `${count.toLocaleString('es-MX')} registros${count > 0 ? ` · mostrando ${from}–${to}` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar empleado, sucursal..."
              className="pl-8 pr-3 py-1.5 rounded-lg text-[12px] h-8 w-56 filter-input
                focus:outline-none focus:ring-2 transition-all"
              style={{ color: 'var(--text-primary)' }}
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-lg leading-none"
                style={{ color: 'var(--text-muted)' }}
              >×</button>
            )}
          </div>
          {/* Export */}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium
              transition-all cursor-pointer focus:outline-none focus:ring-2"
            style={{
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSort(col.key)}
                  className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider
                    cursor-pointer select-none whitespace-nowrap transition-colors focus:outline-none
                    ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  style={{ color: col.key === sortCol ? 'var(--accent)' : 'var(--text-dim)' }}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.label}
                    <SortIcon col={col.key} sortCol={sortCol} sortAsc={sortAsc} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--border)' }}>
                      <Search size={20} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-dim)' }}>Sin resultados</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Ajusta los filtros o amplía el rango de fechas
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Empleado */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.nombre_empleado ?? ''} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium truncate max-w-[150px]"
                          style={{ color: 'var(--text-primary)' }}>
                          {row.nombre_empleado ?? '—'}
                        </p>
                        <p className="text-[10px] truncate max-w-[150px]" style={{ color: 'var(--text-dim)' }}>
                          {row.puesto ?? ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Sucursal */}
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {row.sucursal ?? '—'}
                  </td>

                  {/* Tipo */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: row.tipo === 'entrada' ? 'rgba(34,197,94,0.12)' : 'rgba(139,92,246,0.12)',
                        color:      row.tipo === 'entrada' ? 'var(--success)' : '#8b5cf6',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: row.tipo === 'entrada' ? 'var(--success)' : '#8b5cf6' }} />
                      {row.tipo}
                    </span>
                  </td>

                  {/* Hora */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="mono text-[11px]" style={{ color: 'var(--text-dim)' }}>{row.fecha_local} </span>
                    <span className="mono text-[12px]" style={{ color: 'var(--text-primary)' }}>
                      {row.hora_local?.slice(0, 5)}
                    </span>
                  </td>

                  {/* Confianza */}
                  <td className="px-4 py-3"><ConfidenceBar value={row.confianza_pct} /></td>

                  {/* Puntualidad */}
                  <td className="px-4 py-3"><PuntualidadBadge value={row.clasificacion_retardo} /></td>

                  {/* Retardo */}
                  <td className="px-4 py-3 text-right mono text-[12px]">
                    {row.minutos_retardo != null ? (
                      <span style={{ color: row.minutos_retardo > 0 ? 'var(--warning)' : 'var(--success)' }}>
                        {row.minutos_retardo > 0 ? `+${row.minutos_retardo}m` : '✓'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {count > 0 ? `Página ${page + 1} de ${totalPages}` : ''}
        </span>
        <div className="flex items-center gap-0.5">
          <PagBtn onClick={() => onPageChange(0)} disabled={page === 0 || loading}>«</PagBtn>
          <PagBtn onClick={() => onPageChange(page - 1)} disabled={page === 0 || loading}>‹ Ant</PagBtn>
          {pageNums.map((n) => (
            <PagBtn key={n} onClick={() => onPageChange(n)} active={n === page}>{n + 1}</PagBtn>
          ))}
          <PagBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1 || loading}>Sig ›</PagBtn>
          <PagBtn onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1 || loading}>»</PagBtn>
        </div>
      </div>
    </section>
  )
}
