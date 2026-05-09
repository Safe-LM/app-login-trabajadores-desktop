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
};

export type Granularidad = "dia" | "semana" | "mes";

export type Filtros = {
  empleadoId: string | "all";
  sucursalId: string | "all";
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
};
