export interface AsistenciaDetalle {
  id: number
  empleado_id: number
  employee_number: string | null
  nombre_empleado: string | null
  puesto: string | null
  zona: string | null
  sucursal: string | null
  tipo: 'entrada' | 'salida'
  registrado_en: string          // timestamp UTC
  hora_local: string             // HH:MI:SS local
  fecha_local: string            // YYYY-MM-DD local
  confianza_pct: number          // ya es 0–100
  reconocimiento_facial: boolean
  metodo: string | null
  ubicacion: string | null
  dispositivo: string | null
  hora_entrada_esperada: string | null
  minutos_retardo: number | null
  clasificacion_retardo: string | null
  notas: string | null
  sincronizado_en: string | null
}

export interface KpiData {
  presentesHoy: number
  totalEntradas: number
  totalSalidas: number
  confianzaPromedio: number
}

export interface KpiDelta {
  entradasDelta: number | null
  salidasDelta: number | null
}

export interface TendenciaDia {
  fecha: string
  entradas: number
  salidas: number
}

export interface MetodoCount {
  metodo: string
  total: number
}

export interface SucursalCount {
  sucursal: string
  total: number
}

export interface PuntualidadCount {
  clasificacion: string
  total: number
}

export interface HeatmapCell {
  dia: string
  hora: number
  total: number
}

export interface Filters {
  desde: string
  hasta: string
  sucursal: string
  tipo: string
}

export type SortCol =
  | 'registrado_en'
  | 'nombre_empleado'
  | 'sucursal'
  | 'tipo'
  | 'confianza_pct'
  | 'clasificacion_retardo'
  | 'minutos_retardo'
