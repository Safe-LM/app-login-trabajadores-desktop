export type ReportesRegistro = {
  id: string;
  tipo: "entrada" | "salida";
  timestamp: string;
  confianza: number | null;
  empleado_id: string;
  sucursal_id: string | null;
  empleado_nombre: string | null;
  sucursal_nombre: string | null;
};

export type ReportesEmpleado = {
  id: string;
  nombre: string;
  sucursal_id: string | null;
  activo: boolean;
};

export type ReportesSucursal = {
  id: string;
  nombre: string;
  hora_apertura: string | null;
  hora_cierre: string | null;
  tolerancia_min: number;
};

export type ReportesData = {
  desde: string;
  rangeDays: number;
  registros: ReportesRegistro[];
  empleados: ReportesEmpleado[];
  sucursales: ReportesSucursal[];
  /** Total real de registros en el rango (antes del límite de carga). */
  totalRegistrosReal: number;
  /** El límite de carga aplicado a la consulta. */
  registrosLimit: number;
  /** True si la BD tenía más registros de los que se cargaron (datos parciales). */
  truncado: boolean;
};

export type Granularidad = "dia" | "semana" | "mes";

export type Filtros = {
  empleadoId: string | "all";
  sucursalId: string | "all";
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
};

export type EstadoDia =
  | "completo"        // entrada + salida
  | "retardo"         // entrada + salida, pero entró tarde
  | "sin_salida"      // entró pero NO registró salida  → incidencia
  | "sin_entrada"     // registró salida pero NO entrada → incidencia
  | "ausente";        // sin marcas en el día

export type DiaEmpleado = {
  fecha: string;                 // YYYY-MM-DD
  entrada: string | null;        // HH:mm de la PRIMERA entrada del día, o null
  salida: string | null;         // HH:mm de la ÚLTIMA salida del día, o null
  horas: number | null;          // null si el turno está incompleto, 0 si está ausente, o número de horas
  retardo: boolean;              // entrada posterior a la hora límite + tolerancia
  minutos_retardo: number;       // 0 si no hubo retardo
  estado: EstadoDia;
};

export type EmpleadoFila = {
  empleado_id: string;
  nombre: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  registros: number;
  llegadas_tarde: number;
  horas_trabajadas: number;
  dias_trabajados: number;
  dias_laborables: number;
  ausencias: number;
  asistencia_pct: number;
  activo: boolean;
  incidencias: number;         // total de días con turno incompleto (sin salida o sin entrada)
  ultima_actividad: string | null;
  dias: DiaEmpleado[];         // desglose día por día para la vista de detalle
};

