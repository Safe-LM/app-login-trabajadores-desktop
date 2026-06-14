import type {
  Filtros,
  Granularidad,
  ReportesData,
  ReportesRegistro,
  ReportesSucursal,
  ReportesEmpleado,
  EmpleadoFila,
  DiaEmpleado,
  EstadoDia,
} from "./types";

export type DiaPunto = { fecha: string; label: string; entradas: number; salidas: number; total: number };

export type Kpis = {
  totalRegistros: number;
  empleadosActivos: number;
  diasEnRango: number;
  asistenciasEsperadas: number;
  asistenciasRealizadas: number;
  pctAsistencia: number;
  ausencias: number;
  llegadasTarde: number;
  pctPuntualidad: number;
  horasTrabajadas: number;
  confianzaPromedio: number;
};

export type ComputedReport = {
  registrosFiltrados: ReportesRegistro[];
  serieTiempo: DiaPunto[];
  porSucursal: { name: string; value: number }[];
  porEmpleado: EmpleadoFila[];
  kpis: Kpis;
};

const ONE_DAY_MS = 86_400_000;
const MAX_TURNO_HORAS = 14; // Cap para evitar contar pares colgados como 24h+.
// Debounce: dos marcas del mismo tipo en <5 min = duplicado (mismo "punch").
// Misma regla que la vista de asistencia, para que horas y pares coincidan.
const DEBOUNCE_MS = 5 * 60 * 1000;

export function computeReport(data: ReportesData, filtros: Filtros, granularidad: Granularidad): ComputedReport {
  const desdeMs = parseLocalDateStart(filtros.desde);
  const hastaMs = parseLocalDateEnd(filtros.hasta);
  const sucursalById = new Map<string, ReportesSucursal>(data.sucursales.map(s => [s.id, s]));

  const empleadosFiltrados = filtros.empleadoId === "all"
    ? data.empleados
    : data.empleados.filter(e => e.id === filtros.empleadoId);

  const empleadosScope = empleadosFiltrados.filter(e => filtros.sucursalId === "all" || e.sucursal_id === filtros.sucursalId);
  const empleadosActivos = empleadosScope.filter(e => e.activo).length;

  const registrosFiltrados = data.registros.filter(r => {
    const ts = new Date(r.timestamp).getTime();
    if (Number.isNaN(ts)) return false;
    if (ts < desdeMs || ts > hastaMs) return false;
    if (filtros.empleadoId !== "all" && r.empleado_id !== filtros.empleadoId) return false;
    if (filtros.sucursalId !== "all" && r.sucursal_id !== filtros.sucursalId) return false;
    return true;
  });

  const serieTiempo = buildSerie(registrosFiltrados, desdeMs, hastaMs, granularidad);
  const porSucursal = buildPorSucursal(registrosFiltrados);
  
  const empleadoStats = buildEmpleadoStats(
    empleadosScope,
    registrosFiltrados,
    sucursalById,
    filtros.desde,
    filtros.hasta
  );

  const diasEnRango = Math.max(1, Math.round((hastaMs - desdeMs) / ONE_DAY_MS));
  const diasLaborables = countWeekdays(desdeMs, hastaMs);
  const asistenciasEsperadas = empleadosActivos * diasLaborables;
  
  // Coherencia de totales con los estados de asistencia
  const asistenciasRealizadas = empleadoStats
    .filter(e => e.activo)
    .reduce((acc, e) => acc + e.dias_trabajados, 0);

  const pctAsistencia = asistenciasEsperadas > 0
    ? Math.round((asistenciasRealizadas / asistenciasEsperadas) * 100)
    : 0;
  const ausencias = Math.max(0, asistenciasEsperadas - asistenciasRealizadas);

  const llegadasTarde = empleadoStats.reduce((acc, e) => acc + e.llegadas_tarde, 0);
  const horasTrabajadas = round2(empleadoStats.reduce((acc, e) => acc + e.horas_trabajadas, 0));

  const totalEntradas = registrosFiltrados.filter(r => r.tipo === "entrada").length;
  const pctPuntualidad = totalEntradas > 0
    ? Math.round(((totalEntradas - llegadasTarde) / totalEntradas) * 100)
    : 100;

  const conConfianza = registrosFiltrados.filter(r => typeof r.confianza === "number");
  const confianzaPromedio = conConfianza.length > 0
    ? Math.round((conConfianza.reduce((acc, r) => acc + (r.confianza ?? 0), 0) / conConfianza.length) * 100)
    : 0;

  return {
    registrosFiltrados,
    serieTiempo,
    porSucursal,
    porEmpleado: empleadoStats.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    kpis: {
      totalRegistros: registrosFiltrados.length,
      empleadosActivos,
      diasEnRango,
      asistenciasEsperadas,
      asistenciasRealizadas,
      pctAsistencia,
      ausencias,
      llegadasTarde,
      pctPuntualidad,
      horasTrabajadas,
      confianzaPromedio,
    },
  };
}

function buildSerie(registros: ReportesRegistro[], desdeMs: number, hastaMs: number, granularidad: Granularidad): DiaPunto[] {
  const buckets = new Map<string, DiaPunto>();
  const labelFmt = labelFormatter(granularidad);

  for (let cursor = desdeMs; cursor <= hastaMs; cursor += ONE_DAY_MS) {
    const key = bucketKey(new Date(cursor), granularidad);
    if (!buckets.has(key)) {
      buckets.set(key, { fecha: key, label: labelFmt(new Date(cursor)), entradas: 0, salidas: 0, total: 0 });
    }
  }

  for (const r of registros) {
    const d = new Date(r.timestamp);
    const key = bucketKey(d, granularidad);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (r.tipo === "entrada") bucket.entradas += 1;
    else bucket.salidas += 1;
  }

  return Array.from(buckets.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function buildPorSucursal(registros: ReportesRegistro[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of registros) {
    const name = r.sucursal_nombre ?? "Sin sucursal";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildEmpleadoStats(
  empleadosScope: ReportesEmpleado[],
  registros: ReportesRegistro[],
  sucursales: Map<string, ReportesSucursal>,
  desdeStr: string,
  hastaStr: string
): EmpleadoFila[] {
  const start = new Date(parseLocalDateStart(desdeStr));
  const end = new Date(parseLocalDateStart(hastaStr));
  const diasHabiles: string[] = [];

  let current = new Date(start);
  while (current <= end) {
    diasHabiles.push(
      `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
    );
    current.setDate(current.getDate() + 1);
  }

  const empsStats: EmpleadoFila[] = empleadosScope.map(emp => {
    const suc = emp.sucursal_id ? sucursales.get(emp.sucursal_id) : null;
    const sucursal_nombre = suc?.nombre ?? null;

    return {
      empleado_id: emp.id,
      nombre: emp.nombre,
      sucursal_id: emp.sucursal_id,
      sucursal_nombre,
      registros: 0,
      llegadas_tarde: 0,
      horas_trabajadas: 0,
      dias_trabajados: 0,
      dias_laborables: diasHabiles.length,
      ausencias: 0,
      asistencia_pct: 0,
      activo: emp.activo,
      incidencias: 0,
      ultima_actividad: null,
      dias: []
    };
  });

  const empsMap = new Map<string, EmpleadoFila>();
  for (const stat of empsStats) {
    empsMap.set(stat.empleado_id, stat);
  }

  type RegistroDia = { tipo: "entrada" | "salida"; ts: number; confidence: number | null };
  const recordsMap = new Map<string, Map<string, RegistroDia[]>>(); // employee_id -> dayStr -> RegistroDia[]

  for (const r of registros) {
    const ts = new Date(r.timestamp).getTime();
    if (Number.isNaN(ts)) continue;
    const d = new Date(ts);
    const dayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const empStat = empsMap.get(r.empleado_id);
    if (!empStat) continue;

    empStat.registros += 1;
    if (!empStat.ultima_actividad || r.timestamp > empStat.ultima_actividad) {
      empStat.ultima_actividad = r.timestamp;
    }

    let empDays = recordsMap.get(r.empleado_id);
    if (!empDays) {
      empDays = new Map<string, RegistroDia[]>();
      recordsMap.set(r.empleado_id, empDays);
    }

    let dayRecords = empDays.get(dayKey);
    if (!dayRecords) {
      dayRecords = [];
      empDays.set(dayKey, dayRecords);
    }
    dayRecords.push({ tipo: r.tipo, ts, confidence: r.confianza });
  }

  for (const stat of empsStats) {
    const empDays = recordsMap.get(stat.empleado_id);
    const empSuc = stat.sucursal_id ? sucursales.get(stat.sucursal_id) : null;
    const horaApertura = empSuc?.hora_apertura ?? "09:00:00";
    const toleranciaMin = empSuc?.tolerancia_min ?? 10;

    let diasTrabajadosCount = 0;
    let llegadasTardeCount = 0;
    let incidenciasCount = 0;
    let horasAcumuladas = 0;
    let diasLaborablesCount = 0;
    let ausenciasCount = 0;

    for (const dayStr of diasHabiles) {
      const dateObj = new Date(dayStr + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

      if (!isWeekend) {
        diasLaborablesCount += 1;
      }

      const records = empDays?.get(dayStr) ?? [];

      const sortedRecords = [...records].sort((a, b) => a.ts - b.ts);
      const debounced: RegistroDia[] = [];
      for (const reg of sortedRecords) {
        const last = debounced[debounced.length - 1];
        if (last && last.tipo === reg.tipo && (reg.ts - last.ts) < DEBOUNCE_MS) continue;
        debounced.push(reg);
      }

      const entryReg = debounced.find(r => r.tipo === "entrada");
      const exitReg = [...debounced].reverse().find(r => r.tipo === "salida");

      let entradaTime: string | null = null;
      if (entryReg) {
        entradaTime = formatLocalMXTime(entryReg.ts);
      }

      let salidaTime: string | null = null;
      if (exitReg) {
        salidaTime = formatLocalMXTime(exitReg.ts);
      }

      let estado: EstadoDia = "ausente";
      let horas: number | null = 0;
      let retardo = false;
      let minutosRetardo = 0;

      const hasEntrada = !!entryReg;
      const hasSalida = !!exitReg;

      if (hasEntrada && hasSalida) {
        const rawHours = (exitReg.ts - entryReg.ts) / 3_600_000;
        horas = round2(Math.min(rawHours, MAX_TURNO_HORAS));

        minutosRetardo = computeMinutosTarde(entryReg.ts, horaApertura, toleranciaMin);
        if (minutosRetardo > 0) {
          estado = "retardo";
          retardo = true;
          llegadasTardeCount += 1;
        } else {
          estado = "completo";
        }

        diasTrabajadosCount += 1;
        horasAcumuladas += horas;
      } else if (hasEntrada && !hasSalida) {
        estado = "sin_salida";
        horas = null;
        incidenciasCount += 1;
        diasTrabajadosCount += 1;
      } else if (!hasEntrada && hasSalida) {
        estado = "sin_entrada";
        horas = null;
        incidenciasCount += 1;
        diasTrabajadosCount += 1;
      } else {
        estado = "ausente";
        horas = 0;
        if (!isWeekend) {
          ausenciasCount += 1;
        }
      }

      stat.dias.push({
        fecha: dayStr,
        entrada: entradaTime,
        salida: salidaTime,
        horas,
        retardo,
        minutos_retardo: minutosRetardo,
        estado
      });
    }

    stat.dias_trabajados = diasTrabajadosCount;
    stat.llegadas_tarde = llegadasTardeCount;
    stat.incidencias = incidenciasCount;
    stat.horas_trabajadas = round2(horasAcumuladas);
    stat.dias_laborables = diasLaborablesCount;
    stat.ausencias = ausenciasCount;
    stat.asistencia_pct = stat.dias_laborables > 0
      ? Math.round((diasTrabajadosCount / stat.dias_laborables) * 100)
      : 0;
  }

  return empsStats;
}

const TIMEZONE = "America/Mexico_City";

function formatLocalMXTime(tsMs: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(tsMs));
  const hh = parts.find(p => p.type === "hour")?.value ?? "00";
  const mm = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function minutosLocalMX(tsMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(tsMs));
  const hh = Number(parts.find(p => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find(p => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

function computeMinutosTarde(entradaMs: number, horaApertura: string, toleranciaMin: number): number {
  const [hh, mm] = horaApertura.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  const diffMin = minutosLocalMX(entradaMs) - (hh * 60 + mm);
  return diffMin > toleranciaMin ? diffMin : 0;
}

function countDistinctEmpleadoDia(registros: ReportesRegistro[]): number {
  const set = new Set<string>();
  for (const r of registros) {
    if (r.tipo !== "entrada") continue;
    set.add(`${r.empleado_id}:${bucketKey(new Date(r.timestamp), "dia")}`);
  }
  return set.size;
}

function countWeekdays(desdeMs: number, hastaMs: number): number {
  let count = 0;
  for (let cursor = desdeMs; cursor <= hastaMs; cursor += ONE_DAY_MS) {
    const day = new Date(cursor).getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return Math.max(1, count);
}

function bucketKey(d: Date, granularidad: Granularidad): string {
  if (granularidad === "mes") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (granularidad === "semana") {
    const monday = new Date(d);
    const day = monday.getDay();
    const offset = (day + 6) % 7; // lunes = 0
    monday.setDate(monday.getDate() - offset);
    monday.setHours(0, 0, 0, 0);
    return `${monday.getFullYear()}-W${pad(getISOWeek(monday))}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function labelFormatter(granularidad: Granularidad): (d: Date) => string {
  if (granularidad === "mes") {
    return d => d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  }
  if (granularidad === "semana") {
    return d => `S${pad(getISOWeek(d))}`;
  }
  return d => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function getISOWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * ONE_DAY_MS));
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseLocalDateStart(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

function parseLocalDateEnd(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).getTime();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toCsv(rows: ReportesRegistro[]): string {
  const header = ["fecha", "hora", "empleado", "sucursal", "tipo", "confianza"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const d = new Date(r.timestamp);
    const fecha = d.toLocaleDateString("es-MX");
    const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const empleado = csvEscape(r.empleado_nombre ?? "");
    const sucursal = csvEscape(r.sucursal_nombre ?? "");
    const tipo = r.tipo;
    const confianza = r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "";
    lines.push([fecha, hora, empleado, sucursal, tipo, confianza].join(","));
  }
  return lines.join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
