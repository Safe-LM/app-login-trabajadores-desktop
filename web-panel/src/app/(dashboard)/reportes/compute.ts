import type { Filtros, Granularidad, ReportesData, ReportesRegistro, ReportesSucursal } from "./types";

export type DiaPunto = { fecha: string; label: string; entradas: number; salidas: number; total: number };

export type EmpleadoFila = {
  empleado_id: string;
  nombre: string;
  registros: number;
  llegadas_tarde: number;
  horas_trabajadas: number;
  ultima_actividad: string | null;
};

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

export function computeReport(data: ReportesData, filtros: Filtros, granularidad: Granularidad): ComputedReport {
  const desdeMs = parseLocalDateStart(filtros.desde);
  const hastaMs = parseLocalDateEnd(filtros.hasta);
  const sucursalById = new Map<string, ReportesSucursal>(data.sucursales.map(s => [s.id, s]));

  const empleadosFiltrados = filtros.empleadoId === "all"
    ? data.empleados
    : data.empleados.filter(e => e.id === filtros.empleadoId);

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
  const empleadoStats = buildEmpleadoStats(registrosFiltrados, sucursalById);

  const empleadosScope = empleadosFiltrados.filter(e => filtros.sucursalId === "all" || e.sucursal_id === filtros.sucursalId);
  const empleadosActivos = empleadosScope.filter(e => e.activo).length;

  const diasEnRango = Math.max(1, Math.round((hastaMs - desdeMs) / ONE_DAY_MS));
  const diasLaborables = countWeekdays(desdeMs, hastaMs);
  const asistenciasEsperadas = empleadosActivos * diasLaborables;
  const asistenciasRealizadas = countDistinctEmpleadoDia(registrosFiltrados);
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
    porEmpleado: empleadoStats.sort((a, b) => b.registros - a.registros),
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

function buildEmpleadoStats(registros: ReportesRegistro[], sucursales: Map<string, ReportesSucursal>): EmpleadoFila[] {
  type RegistroDia = { tipo: "entrada" | "salida"; ts: number };
  type Acc = {
    nombre: string;
    registros: number;
    llegadasTarde: number;
    horasTrabajadas: number;
    ultimoTs: string | null;
    porDia: Map<string, { items: RegistroDia[]; sucursalId: string | null }>;
  };

  const map = new Map<string, Acc>();

  for (const r of registros) {
    let acc = map.get(r.empleado_id);
    if (!acc) {
      acc = {
        nombre: r.empleado_nombre ?? r.empleado_id.slice(0, 8),
        registros: 0,
        llegadasTarde: 0,
        horasTrabajadas: 0,
        ultimoTs: null,
        porDia: new Map(),
      };
      map.set(r.empleado_id, acc);
    }
    acc.registros += 1;
    if (!acc.ultimoTs || r.timestamp > acc.ultimoTs) acc.ultimoTs = r.timestamp;

    const ts = new Date(r.timestamp).getTime();
    const dayKey = bucketKey(new Date(ts), "dia");
    const dia = acc.porDia.get(dayKey) ?? { items: [], sucursalId: r.sucursal_id };
    dia.items.push({ tipo: r.tipo as "entrada" | "salida", ts });
    dia.sucursalId = dia.sucursalId ?? r.sucursal_id;
    acc.porDia.set(dayKey, dia);
  }

  for (const acc of map.values()) {
    for (const dia of acc.porDia.values()) {
      // Pares greedy: misma lógica que la vista de asistencia.
      // Suma solo el tiempo real trabajado, excluye breaks/comidas.
      const sorted = [...dia.items].sort((a, b) => a.ts - b.ts);
      let currentEntrada: number | null = null;
      let horasDia = 0;
      let primeraEntrada: number | null = null;
      for (const reg of sorted) {
        if (reg.tipo === "entrada") {
          if (currentEntrada !== null) horasDia += (reg.ts - currentEntrada) / 3_600_000;
          currentEntrada = reg.ts;
          if (primeraEntrada === null) primeraEntrada = reg.ts;
        } else if (currentEntrada !== null) {
          horasDia += (reg.ts - currentEntrada) / 3_600_000;
          currentEntrada = null;
        }
      }
      acc.horasTrabajadas += Math.min(horasDia, MAX_TURNO_HORAS);

      if (primeraEntrada !== null && dia.sucursalId) {
        const suc = sucursales.get(dia.sucursalId);
        if (suc?.hora_apertura) {
          const minutosTarde = computeMinutosTarde(primeraEntrada, suc.hora_apertura, suc.tolerancia_min);
          if (minutosTarde > 0) acc.llegadasTarde += 1;
        }
      }
    }
  }

  return Array.from(map.entries()).map(([id, acc]) => ({
    empleado_id: id,
    nombre: acc.nombre,
    registros: acc.registros,
    llegadas_tarde: acc.llegadasTarde,
    horas_trabajadas: round2(acc.horasTrabajadas),
    ultima_actividad: acc.ultimoTs,
  }));
}

const TIMEZONE = "America/Mexico_City";

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
