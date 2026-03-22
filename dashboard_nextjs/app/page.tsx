'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { format, subDays } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Users, LogIn, LogOut, Shield } from 'lucide-react'

import KpiCard from '@/components/KpiCard'
import Header from '@/components/Header'
import AttendanceTable from '@/components/AttendanceTable'
import Toast, { type ToastType } from '@/components/Toast'
import SplashScreen from '@/components/SplashScreen'
import { useAuth } from '@/lib/auth-context'

import {
  fetchAsistencias,
  fetchKpis,
  fetchKpiDelta,
  fetchTendencia,
  fetchMetodos,
  fetchSucursales,
  fetchPuntualidad,
  fetchSucursalesList,
  fetchAllForExport,
  fetchHourlyHeatmap,
} from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useDebounce } from '@/lib/useDebounce'
import type {
  Filters,
  KpiData,
  KpiDelta,
  TendenciaDia,
  MetodoCount,
  SucursalCount,
  PuntualidadCount,
  AsistenciaDetalle,
  HeatmapCell,
  SortCol,
} from '@/lib/types'

// Dynamic imports for chart components (recharts uses browser APIs)
const TrendChart    = dynamic(() => import('@/components/TrendChart'),    { ssr: false })
const DonutChart    = dynamic(() => import('@/components/DonutChart'),    { ssr: false })
const SucursalChart = dynamic(() => import('@/components/SucursalChart'), { ssr: false })
const HeatmapChart  = dynamic(() => import('@/components/HeatmapChart'),  { ssr: false })

const PAGE_SIZE       = 25
const REFRESH_INTERVAL = 60_000

const METODO_COLORS      = ['#00d2ff', '#3a86ff', '#8b5cf6', '#f59e0b', '#22c55e']
const PUNTUALIDAD_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444']

function getDefaultFilters(): Filters {
  const hasta = format(new Date(), 'yyyy-MM-dd')
  const desde = format(subDays(new Date(), 29), 'yyyy-MM-dd')
  return { desde, hasta, sucursal: '', tipo: '' }
}

function exportToCsv(rows: AsistenciaDetalle[]) {
  const BOM = '\uFEFF'
  const headers = [
    'ID', 'Empleado', 'Puesto', 'Sucursal', 'Tipo',
    'Fecha', 'Hora Local', 'Confianza', 'Método',
    'Puntualidad', 'Retardo (min)', 'Dispositivo',
  ]
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((r) =>
    [
      r.id, r.nombre_empleado, r.puesto, r.sucursal, r.tipo,
      r.fecha_local, r.hora_local?.slice(0, 8),
      Math.round(r.confianza_pct ?? 0) + '%',
      r.metodo, r.clasificacion_retardo,
      r.minutos_retardo, r.dispositivo,
    ].map(esc).join(',')
  )
  const csv   = BOM + [headers.join(','), ...lines].join('\r\n')
  const blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = `asistencias_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Toast helper ─────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '', type: 'loading', visible: false,
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, type: ToastType, duration = 2500) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, type, visible: true })
    if (type !== 'loading') {
      timerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), duration)
    }
  }, [])

  const hide = useCallback(() => setToast((t) => ({ ...t, visible: false })), [])

  return { toast, show, hide }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [splashDone, setSplashDone] = useState(false)

  // Redirigir si no hay sesión (después de que auth cargó)
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const [filters, setFilters]       = useState<Filters>(getDefaultFilters)
  const [page, setPage]             = useState(0)
  const [search, setSearch]         = useState('')
  const [sortCol, setSortCol]       = useState<SortCol>('registrado_en')
  const [sortAsc, setSortAsc]       = useState(false)

  const debouncedSearch = useDebounce(search, 350)

  const [kpis, setKpis]                 = useState<KpiData | null>(null)
  const [kpiDelta, setKpiDelta]         = useState<KpiDelta>({ entradasDelta: null, salidasDelta: null })
  const [tendencia, setTendencia]       = useState<TendenciaDia[]>([])
  const [metodos, setMetodos]           = useState<MetodoCount[]>([])
  const [sucursalesChart, setSucursalesChart] = useState<SucursalCount[]>([])
  const [puntualidad, setPuntualidad]   = useState<PuntualidadCount[]>([])
  const [heatmap, setHeatmap]           = useState<HeatmapCell[]>([])
  const [tableData, setTableData]       = useState<AsistenciaDetalle[]>([])
  const [tableCount, setTableCount]     = useState(0)
  const [sucursalesList, setSucursalesList] = useState<string[]>([])

  const [loading, setLoading]           = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [connected, setConnected]       = useState<boolean | null>(null)

  const { toast, show: showToast } = useToast()
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load charts & KPIs ──────────────────────────────────────────────────────
  const loadCharts = useCallback(async (f: Filters) => {
    setLoading(true)
    try {
      const [k, delta, t, m, s, p, h] = await Promise.all([
        fetchKpis(f),
        fetchKpiDelta(f),
        fetchTendencia(f),
        fetchMetodos(f),
        fetchSucursales(f),
        fetchPuntualidad(f),
        fetchHourlyHeatmap(f),
      ])
      setKpis(k)
      setKpiDelta(delta)
      setTendencia(t)
      setMetodos(m)
      setSucursalesChart(s)
      setPuntualidad(p)
      setHeatmap(h)
      setConnected(true)
    } catch {
      setConnected(false)
      showToast('Error al conectar con Supabase', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ── Load table ───────────────────────────────────────────────────────────────
  const loadTable = useCallback(
    async (f: Filters, pg: number, q: string, sc: SortCol, sa: boolean) => {
      setTableLoading(true)
      try {
        const { data, count } = await fetchAsistencias(f, pg, PAGE_SIZE, q, sc, sa)
        setTableData(data)
        setTableCount(count)
      } finally {
        setTableLoading(false)
      }
    },
    []
  )

  const loadAll = useCallback(
    (f: Filters, pg: number, q: string, sc: SortCol, sa: boolean) => {
      loadCharts(f)
      loadTable(f, pg, q, sc, sa)
    },
    [loadCharts, loadTable]
  )

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSucursalesList().then(setSucursalesList)
    loadAll(filters, 0, '', sortCol, sortAsc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Debounced search → reload table ─────────────────────────────────────────
  useEffect(() => {
    setPage(0)
    loadTable(filters, 0, debouncedSearch, sortCol, sortAsc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // ── Auto-refresh every 60s ───────────────────────────────────────────────────
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(() => {
      loadAll(filters, page, debouncedSearch, sortCol, sortAsc)
    }, REFRESH_INTERVAL)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [filters, page, debouncedSearch, sortCol, sortAsc, loadAll])

  // ── Supabase Realtime — escucha nuevos registros ─────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('asistencias-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asistencias' },
        () => {
          showToast('Nuevo registro detectado — actualizando…', 'loading')
          loadAll(filters, page, debouncedSearch, sortCol, sortAsc)
          setTimeout(() => showToast('Datos actualizados', 'success'), 1800)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, debouncedSearch, sortCol, sortAsc])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleFiltersChange = (f: Filters) => {
    setFilters(f)
    setPage(0)
    loadAll(f, 0, debouncedSearch, sortCol, sortAsc)
  }

  const handlePageChange = (pg: number) => {
    setPage(pg)
    loadTable(filters, pg, debouncedSearch, sortCol, sortAsc)
  }

  const handleSort = (col: SortCol) => {
    const asc = col === sortCol ? !sortAsc : false
    setSortCol(col)
    setSortAsc(asc)
    setPage(0)
    loadTable(filters, 0, debouncedSearch, col, asc)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    showToast('Actualizando datos…', 'loading')
    loadAll(filters, page, debouncedSearch, sortCol, sortAsc)
    setRefreshing(false)
    showToast('Datos actualizados', 'success')
  }

  const handleExport = async () => {
    showToast('Generando CSV…', 'loading')
    try {
      const rows = await fetchAllForExport(filters)
      exportToCsv(rows)
      showToast(`CSV exportado · ${rows.length} registros`, 'success')
    } catch {
      showToast('Error al exportar', 'error')
    }
  }

  // ── Chart data ────────────────────────────────────────────────────────────────
  const metodoChartData      = metodos.map((m) => ({ name: m.metodo, value: m.total }))
  const puntualidadChartData = puntualidad.map((p) => ({ name: p.clasificacion, value: p.total }))

  // Auth loading — blank screen mientras Supabase verifica la sesión
  if (authLoading || !user) return null

  return (
    <>
      {/* Splash screen — se muestra solo la primera vez */}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      <Header
        filters={filters}
        onFiltersChange={handleFiltersChange}
        sucursales={sucursalesList}
        connected={connected}
        onRefresh={handleRefresh}
        onExport={handleExport}
        refreshing={refreshing}
      />

      <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── KPI Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in">
          <KpiCard
            label="Presentes Hoy"
            value={kpis?.presentesHoy ?? '--'}
            sub="empleados con entrada registrada"
            color="#22c55e"
            loading={loading}
            icon={<Users size={16} color="#22c55e" />}
          />
          <KpiCard
            label="Entradas"
            value={kpis?.totalEntradas ?? '--'}
            sub="registros en el período"
            color="#00d2ff"
            loading={loading}
            icon={<LogIn size={16} color="#00d2ff" />}
            delta={kpiDelta.entradasDelta}
            currentVal={kpis?.totalEntradas}
          />
          <KpiCard
            label="Salidas"
            value={kpis?.totalSalidas ?? '--'}
            sub="registros en el período"
            color="#3a86ff"
            loading={loading}
            icon={<LogOut size={16} color="#3a86ff" />}
            delta={kpiDelta.salidasDelta}
            currentVal={kpis?.totalSalidas}
          />
          <KpiCard
            label="Confianza IA"
            value={kpis != null ? `${kpis.confianzaPromedio}%` : '--%'}
            sub="promedio reconocimiento facial"
            color="#f59e0b"
            loading={loading}
            icon={<Shield size={16} color="#f59e0b" />}
          />
        </section>

        {/* ── Charts Row 1: Tendencia + Métodos ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Tendencia de Asistencias</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Entradas y salidas por día</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(0,210,255,0.1)', color: '#00d2ff' }}>
                Últimos 7 días
              </span>
            </div>
            {loading ? <div className="skeleton h-[200px] rounded-xl" /> : <TrendChart data={tendencia} />}
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Método de Reconocimiento</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Distribución por tecnología IA</p>
            </div>
            {loading ? <div className="skeleton h-[200px] rounded-xl" /> : <DonutChart data={metodoChartData} colors={METODO_COLORS} />}
          </div>
        </section>

        {/* ── Charts Row 2: Sucursales + Puntualidad ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-in">
          <div className="card p-5">
            <div className="mb-4">
              <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Asistencias por Sucursal</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Total entradas en el período</p>
            </div>
            {loading ? <div className="skeleton h-[220px] rounded-xl" /> : <SucursalChart data={sucursalesChart} />}
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Clasificación de Puntualidad</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Distribución por retardo de entrada</p>
            </div>
            {loading
              ? <div className="skeleton h-[220px] rounded-xl" />
              : <DonutChart data={puntualidadChartData} colors={PUNTUALIDAD_COLORS} height={220} />}
          </div>
        </section>

        {/* ── Heatmap ── */}
        <section className="card p-5 fade-in">
          <div className="mb-4">
            <h3 className="heading text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Mapa de Calor — Hora de Entrada por Día
            </h3>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Concentración de entradas por hora y día de la semana
            </p>
          </div>
          {loading
            ? <div className="skeleton h-[180px] rounded-xl" />
            : <HeatmapChart data={heatmap} />}
        </section>

        {/* ── Table ── */}
        <div className="fade-in">
          <AttendanceTable
            data={tableData}
            count={tableCount}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
            search={search}
            onSearchChange={setSearch}
            loading={tableLoading}
            onExport={handleExport}
            sortCol={sortCol}
            sortAsc={sortAsc}
            onSort={handleSort}
          />
        </div>

      </main>

      {/* ── Toast ── */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  )
}
