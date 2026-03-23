import { supabase } from './supabase'
import type {
  AsistenciaDetalle,
  KpiData,
  KpiDelta,
  TendenciaDia,
  MetodoCount,
  SucursalCount,
  PuntualidadCount,
  Filters,
  SortCol,
} from './types'
import { format, subDays } from 'date-fns'

function applyFilters(query: any, filters: Filters) {
  if (filters.desde) query = query.gte('fecha_local', filters.desde)
  if (filters.hasta) query = query.lte('fecha_local', filters.hasta)
  if (filters.sucursal) query = query.eq('sucursal', filters.sucursal)
  if (filters.tipo) query = query.eq('tipo', filters.tipo)
  return query
}

// ─── Asistencias paginadas ────────────────────────────────────────────────────

export async function fetchAsistencias(
  filters: Filters,
  page: number,
  pageSize: number,
  search: string,
  sortCol: SortCol = 'registrado_en',
  sortAsc: boolean = false
): Promise<{ data: AsistenciaDetalle[]; count: number }> {
  let query = supabase
    .from('v_asistencias_detalle')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending: sortAsc })

  query = applyFilters(query, filters)

  if (search) {
    query = query.or(
      `nombre_empleado.ilike.%${search}%,sucursal.ilike.%${search}%,puesto.ilike.%${search}%,metodo.ilike.%${search}%`
    )
  }

  const from = page * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, count, error } = await query
  if (error) throw error
  return { data: (data ?? []) as AsistenciaDetalle[], count: count ?? 0 }
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function fetchKpis(filters: Filters): Promise<KpiData> {
  const today = format(new Date(), 'yyyy-MM-dd')

  // Presentes hoy (entradas únicas por empleado)
  const { data: presentesData } = await supabase
    .from('v_asistencias_detalle')
    .select('empleado_id')
    .eq('tipo', 'entrada')
    .eq('fecha_local', today)

  const presentesHoy = new Set(presentesData?.map((r) => r.empleado_id) ?? []).size

  // Conteos con head: true (sin descargar filas)
  const [{ count: cEntradas }, { count: cSalidas }] = await Promise.all([
    supabase
      .from('v_asistencias_detalle')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'entrada')
      .gte('fecha_local', filters.desde || '2000-01-01')
      .lte('fecha_local', filters.hasta || '2099-12-31'),
    supabase
      .from('v_asistencias_detalle')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'salida')
      .gte('fecha_local', filters.desde || '2000-01-01')
      .lte('fecha_local', filters.hasta || '2099-12-31'),
  ])

  // Confianza promedio (confianza_pct ya es 0–100)
  let confQuery = supabase.from('v_asistencias_detalle').select('confianza_pct')
  confQuery = applyFilters(confQuery, filters)
  const { data: confData } = await confQuery

  const avgConfianza =
    confData && confData.length > 0
      ? confData.reduce((s: number, r: any) => s + (r.confianza_pct ?? 0), 0) / confData.length
      : 0

  return {
    presentesHoy,
    totalEntradas: (cEntradas as number) ?? 0,
    totalSalidas: (cSalidas as number) ?? 0,
    confianzaPromedio: Math.round(avgConfianza),
  }
}

// ─── KPI Delta ────────────────────────────────────────────────────────────────

export async function fetchKpiDelta(filters: Filters): Promise<KpiDelta> {
  if (!filters.desde || !filters.hasta)
    return { entradasDelta: null, salidasDelta: null }

  const desde = new Date(filters.desde + 'T12:00:00')
  const hasta = new Date(filters.hasta + 'T12:00:00')
  const days = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000)

  const prevDesde = format(subDays(desde, days + 1), 'yyyy-MM-dd')
  const prevHasta = format(subDays(desde, 1), 'yyyy-MM-dd')

  const [{ count: prevEntradas }, { count: prevSalidas }] = await Promise.all([
    supabase
      .from('v_asistencias_detalle')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'entrada')
      .gte('fecha_local', prevDesde)
      .lte('fecha_local', prevHasta),
    supabase
      .from('v_asistencias_detalle')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'salida')
      .gte('fecha_local', prevDesde)
      .lte('fecha_local', prevHasta),
  ])

  return {
    entradasDelta: (prevEntradas as number) ?? 0,
    salidasDelta: (prevSalidas as number) ?? 0,
  }
}

// ─── Tendencia ────────────────────────────────────────────────────────────────

export async function fetchTendencia(filters: Filters): Promise<TendenciaDia[]> {
  const hasta = filters.hasta || format(new Date(), 'yyyy-MM-dd')
  const desde7 = format(subDays(new Date(hasta + 'T12:00:00'), 6), 'yyyy-MM-dd')

  let query = supabase
    .from('v_asistencias_detalle')
    .select('fecha_local, tipo')
    .gte('fecha_local', desde7)
    .lte('fecha_local', hasta)

  if (filters.sucursal) query = query.eq('sucursal', filters.sucursal)

  const { data } = await query

  const map: Record<string, { entradas: number; salidas: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(new Date(hasta + 'T12:00:00'), i), 'yyyy-MM-dd')
    map[d] = { entradas: 0, salidas: 0 }
  }

  data?.forEach((r) => {
    if (!map[r.fecha_local]) return
    if (r.tipo === 'entrada') map[r.fecha_local].entradas++
    else map[r.fecha_local].salidas++
  })

  return Object.entries(map).map(([fecha, v]) => ({ fecha, ...v }))
}

// ─── Métodos ──────────────────────────────────────────────────────────────────

export async function fetchMetodos(filters: Filters): Promise<MetodoCount[]> {
  let query = supabase.from('v_asistencias_detalle').select('metodo')
  query = applyFilters(query, filters)
  const { data } = await query

  const map: Record<string, number> = {}
  data?.forEach((r) => {
    const k = r.metodo ?? 'desconocido'
    map[k] = (map[k] ?? 0) + 1
  })

  return Object.entries(map)
    .map(([metodo, total]) => ({ metodo, total }))
    .sort((a, b) => b.total - a.total)
}

// ─── Sucursales chart ─────────────────────────────────────────────────────────

export async function fetchSucursales(filters: Filters): Promise<SucursalCount[]> {
  let query = supabase
    .from('v_asistencias_detalle')
    .select('sucursal')
    .eq('tipo', 'entrada')

  if (filters.desde) query = query.gte('fecha_local', filters.desde)
  if (filters.hasta) query = query.lte('fecha_local', filters.hasta)

  const { data } = await query
  const map: Record<string, number> = {}
  data?.forEach((r) => {
    const k = r.sucursal ?? 'Sin sucursal'
    map[k] = (map[k] ?? 0) + 1
  })

  return Object.entries(map)
    .map(([sucursal, total]) => ({ sucursal, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
}

// ─── Puntualidad ──────────────────────────────────────────────────────────────

export async function fetchPuntualidad(filters: Filters): Promise<PuntualidadCount[]> {
  let query = supabase
    .from('v_asistencias_detalle')
    .select('clasificacion_retardo')
    .eq('tipo', 'entrada')
    .not('clasificacion_retardo', 'is', null)
    .neq('clasificacion_retardo', 'N/A')

  query = applyFilters(query, filters)
  const { data } = await query

  const map: Record<string, number> = {}
  data?.forEach((r) => {
    const k = r.clasificacion_retardo ?? 'Sin datos'
    map[k] = (map[k] ?? 0) + 1
  })

  return Object.entries(map).map(([clasificacion, total]) => ({ clasificacion, total }))
}

// ─── Heatmap por hora ─────────────────────────────────────────────────────────

export async function fetchHourlyHeatmap(
  filters: Filters
): Promise<{ dia: string; hora: number; total: number }[]> {
  let query = supabase
    .from('v_asistencias_detalle')
    .select('hora_local, fecha_local')
    .eq('tipo', 'entrada')

  query = applyFilters(query, filters)
  const { data } = await query

  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const map: Record<string, number> = {}

  data?.forEach((r) => {
    const hora = parseInt(r.hora_local?.slice(0, 2) ?? '0', 10)
    const date = new Date(r.fecha_local + 'T12:00:00')
    const dow = date.getDay() // 0=domingo
    const dia = DIAS[dow === 0 ? 6 : dow - 1]
    const key = `${dia}-${hora}`
    map[key] = (map[key] ?? 0) + 1
  })

  const result: { dia: string; hora: number; total: number }[] = []
  DIAS.forEach((dia) => {
    for (let h = 5; h <= 22; h++) {
      result.push({ dia, hora: h, total: map[`${dia}-${h}`] ?? 0 })
    }
  })

  return result
}

// ─── Lista de sucursales ──────────────────────────────────────────────────────

export async function fetchSucursalesList(): Promise<string[]> {
  const { data } = await supabase
    .from('sucursales')
    .select('nombre')
    .eq('activo', true)
    .order('nombre')

  return (data?.map((r) => r.nombre).filter(Boolean) ?? []) as string[]
}

// ─── Export CSV (chunked) ─────────────────────────────────────────────────────

export async function fetchAllForExport(filters: Filters): Promise<AsistenciaDetalle[]> {
  const CHUNK = 1000
  const all: AsistenciaDetalle[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('v_asistencias_detalle')
      .select('*')
      .order('registrado_en', { ascending: false })
      .range(from, from + CHUNK - 1)

    query = applyFilters(query, filters)

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...(data as AsistenciaDetalle[]))
    if (data.length < CHUNK) break
    from += CHUNK
  }

  return all
}
