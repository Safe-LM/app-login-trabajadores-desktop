"use client";
import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { computeReport } from "./compute";
import type { ComputedReport, EmpleadoFila } from "./compute";
import type { Filtros, Granularidad, ReportesData } from "./types";
import { ExportButton } from "@/components/ui/ExportButton";

const CHART_COLORS = ["#3B82F6", "#60A5FA", "#93C5FD", "#22c55e", "#eab308", "#f87171", "#a78bfa", "#f472b6"];

export function ReportesClient({ data }: { data: ReportesData }) {
  const today = todayString();
  const desdeDefault = isoDate(new Date(data.desde));
  const [filtros, setFiltros] = useState<Filtros>({
    empleadoId: "all",
    sucursalId: "all",
    desde: desdeDefault,
    hasta: today,
  });
  const [granularidad, setGranularidad] = useState<Granularidad>("semana");

  const empleadosVisibles = useMemo(() => {
    if (filtros.sucursalId === "all") return data.empleados;
    return data.empleados.filter(e => e.sucursal_id === filtros.sucursalId);
  }, [data.empleados, filtros.sucursalId]);

  const report: ComputedReport = useMemo(
    () => computeReport(data, filtros, granularidad),
    [data, filtros, granularidad]
  );

  function setFiltro<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    setFiltros(prev => {
      const next = { ...prev, [key]: value };
      if (key === "sucursalId" && prev.empleadoId !== "all") {
        const empleado = data.empleados.find(e => e.id === prev.empleadoId);
        if (empleado && value !== "all" && empleado.sucursal_id !== value) {
          next.empleadoId = "all";
        }
      }
      return next;
    });
  }

  const sinHorario = data.sucursales.length === 0 || data.sucursales.every(s => !s.hora_apertura);
  const sinSucursalEnRegistros = report.registrosFiltrados.every(r => !r.sucursal_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <FilterBar
        filtros={filtros}
        setFiltro={setFiltro}
        setFiltros={setFiltros}
        granularidad={granularidad}
        setGranularidad={setGranularidad}
        sucursales={data.sucursales}
        empleados={empleadosVisibles}
        exportRows={() => report.registrosFiltrados as unknown as Record<string, unknown>[]}
        exportFilenamePrefix={`reporte_asistencia_${filtros.desde}_${filtros.hasta}`}
        rangeDays={data.rangeDays}
      />

      {(sinHorario || sinSucursalEnRegistros) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
          background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.25)",
          borderRadius: 10, fontSize: 12, color: "#fbbf24",
        }}>
          <span style={{ fontSize: 16 }}>⚠</span>
          <div>
            <span style={{ fontWeight: 700 }}>Retardos no disponibles — </span>
            {sinSucursalEnRegistros
              ? "el dispositivo no tiene sucursal asignada."
              : "las sucursales no tienen hora de apertura configurada."
            }
            {" "}
            <span style={{ color: "rgba(251,191,36,0.7)" }}>
              {sinSucursalEnRegistros ? "Ve a Estaciones → editar → asignar sucursal." : "Ve a Sucursales → editar → configurar hora de apertura."}
            </span>
          </div>
        </div>
      )}

      <KpiGrid kpis={report.kpis} sinHorario={sinHorario || sinSucursalEnRegistros} />

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }} className="reportes-charts-grid">
        <ChartCard
          title="Actividad"
          subtitle={granularityLabel(granularidad)}
          badge={`${report.registrosFiltrados.filter(r => r.tipo === "entrada").length} entradas · ${report.registrosFiltrados.filter(r => r.tipo === "salida").length} salidas`}
        >
          {report.serieTiempo.length === 0 ? (
            <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
              Sin registros en el rango seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={report.serieTiempo} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="entradasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="salidasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(12,12,14,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                  labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)", paddingTop: 12 }}
                />
                <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2.5} fill="url(#entradasGrad)" name="Entradas" dot={false} activeDot={{ r: 4, fill: "#22c55e", strokeWidth: 0 }} />
                <Area type="monotone" dataKey="salidas"  stroke="#3b82f6" strokeWidth={2.5} fill="url(#salidasGrad)"  name="Salidas"  dot={false} activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Por sucursal" subtitle={`${report.porSucursal.length} ubicación${report.porSucursal.length !== 1 ? "es" : ""}`}>
          {report.porSucursal.length === 0 ? (
            <div style={{ height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-faint)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: 12 }}>Sin sucursal asignada</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={report.porSucursal} cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                  {report.porSucursal.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgba(12,12,14,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.45)", paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <EmpleadosTable rows={report.porEmpleado} />

      <RegistrosTable rows={report.registrosFiltrados} />

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.reportes-charts-grid) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────── FILTROS ─────────────── */
function FilterBar({
  filtros, setFiltro, setFiltros, granularidad, setGranularidad,
  sucursales, empleados, exportRows, exportFilenamePrefix, rangeDays,
}: {
  filtros: Filtros;
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void;
  setFiltros: React.Dispatch<React.SetStateAction<Filtros>>;
  granularidad: Granularidad;
  setGranularidad: (g: Granularidad) => void;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
  exportRows: () => Record<string, unknown>[];
  exportFilenamePrefix: string;
  rangeDays: number;
}) {
  const today = todayString();
  const minDate = isoDate(daysAgo(rangeDays));

  const quickRanges = [
    { label: "Hoy",     desde: today,               hasta: today },
    { label: "7 días",  desde: isoDate(daysAgo(6)),  hasta: today },
    { label: "30 días", desde: isoDate(daysAgo(29)), hasta: today },
  ];

  const activeQuick = quickRanges.find(r => r.desde === filtros.desde && r.hasta === filtros.hasta);

  return (
    <div className="card" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Fila 1: Rangos rápidos + granularidad */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Rango</span>
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {quickRanges.map(r => (
            <button key={r.label} type="button"
              onClick={() => setFiltros(f => ({ ...f, desde: r.desde, hasta: r.hasta }))}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                background: activeQuick?.label === r.label ? "var(--accent)" : "transparent",
                color: activeQuick?.label === r.label ? "#fff" : "var(--text-muted)",
                transition: "all 120ms",
              }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agrupado por</span>
          <div style={{ display: "flex", gap: 3, padding: 3, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
            {(["dia", "semana", "mes"] as Granularidad[]).map(g => (
              <button key={g} type="button" onClick={() => setGranularidad(g)} style={{
                padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                background: granularidad === g ? "var(--accent)" : "transparent",
                color: granularidad === g ? "#fff" : "var(--text-muted)",
                fontSize: 12, fontWeight: 600, textTransform: "capitalize", transition: "all 120ms",
              }}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Fila 2: Filtros */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
        <Field label="Desde">
          <input type="date" className="input" value={filtros.desde} min={minDate} max={filtros.hasta}
            onChange={e => setFiltro("desde", e.target.value)} style={{ colorScheme: "dark" }} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={filtros.hasta} min={filtros.desde} max={today}
            onChange={e => setFiltro("hasta", e.target.value)} style={{ colorScheme: "dark" }} />
        </Field>
        <Field label="Sucursal">
          <select className="input" value={filtros.sucursalId}
            onChange={e => setFiltro("sucursalId", e.target.value as Filtros["sucursalId"])}>
            <option value="all">Todas</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </Field>
        <Field label="Empleado">
          <select className="input" value={filtros.empleadoId}
            onChange={e => setFiltro("empleadoId", e.target.value as Filtros["empleadoId"])}>
            <option value="all">Todos</option>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </Field>
        <Field label="Exportar">
          <ExportButton getRows={exportRows} filenamePrefix={exportFilenamePrefix} sheetName="Asistencia" label="Descargar" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  );
}

/* ─────────────── KPIs ─────────────── */
const KPI_ICONS: Record<string, React.ReactNode> = {
  registros:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>,
  asistencia: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  puntual:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ausencias:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  horas:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/></svg>,
  confianza:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

function KpiGrid({ kpis, sinHorario }: { kpis: ComputedReport["kpis"]; sinHorario: boolean }) {
  const horasPromDia = kpis.diasEnRango > 0 ? (kpis.horasTrabajadas / kpis.diasEnRango).toFixed(1) : "0.0";

  type Item = { key: string; label: string; value: string; sub: string; tone?: "good" | "warn" | "bad"; noData?: boolean };
  const items: Item[] = [
    { key: "registros",  label: "Total registros",   value: String(kpis.totalRegistros), sub: `${kpis.diasEnRango} día${kpis.diasEnRango !== 1 ? "s" : ""} en rango` },
    { key: "asistencia", label: "Asistencia",         value: `${kpis.asistenciasRealizadas}/${kpis.asistenciasEsperadas}`, sub: `${kpis.pctAsistencia}% del esperado`, tone: kpis.pctAsistencia >= 80 ? "good" : kpis.pctAsistencia >= 60 ? "warn" : "bad" },
    { key: "puntual",    label: "Puntualidad",        value: sinHorario ? "—" : `${kpis.pctPuntualidad}%`, sub: sinHorario ? "Sin horario configurado" : `${kpis.llegadasTarde} llegada${kpis.llegadasTarde !== 1 ? "s" : ""} tarde`, tone: sinHorario ? undefined : kpis.pctPuntualidad >= 90 ? "good" : kpis.pctPuntualidad >= 70 ? "warn" : "bad", noData: sinHorario },
    { key: "ausencias",  label: "Ausencias",          value: String(kpis.ausencias), sub: `${kpis.empleadosActivos} empleado${kpis.empleadosActivos !== 1 ? "s" : ""} activos`, tone: kpis.ausencias === 0 ? "good" : kpis.ausencias > kpis.asistenciasEsperadas / 4 ? "bad" : "warn" },
    { key: "horas",      label: "Horas trabajadas",   value: kpis.horasTrabajadas > 0 ? `${kpis.horasTrabajadas.toFixed(1)}h` : "—", sub: kpis.horasTrabajadas > 0 ? `~${horasPromDia}h promedio/día` : "Sin pares entrada/salida" },
    { key: "confianza",  label: "Confianza facial",   value: `${kpis.confianzaPromedio}%`, sub: "promedio del rango", tone: kpis.confianzaPromedio >= 85 ? "good" : kpis.confianzaPromedio >= 70 ? "warn" : kpis.confianzaPromedio > 0 ? "bad" : undefined },
  ];

  const toneColor = { good: "#22c55e", warn: "#eab308", bad: "#ef4444" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
      {items.map(it => {
        const color = it.noData ? "rgba(255,255,255,0.25)" : it.tone ? toneColor[it.tone] : "var(--text-faint)";
        return (
          <div key={it.key} className="card" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
            {it.tone && !it.noData && (
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${toneColor[it.tone]}, transparent)`, opacity: 0.6 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{it.label}</p>
              <span style={{ color, opacity: 0.7 }}>{KPI_ICONS[it.key]}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, color: it.noData ? "rgba(255,255,255,0.25)" : "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", margin: 0 }}>
              {it.value}
            </p>
            <p style={{ fontSize: 11, color: it.noData ? "rgba(255,255,255,0.2)" : "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>{it.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── CHART CARD ─────────────── */
function ChartCard({ title, subtitle, badge, children }: { title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 className="heading-3" style={{ marginBottom: 2 }}>{title}</h3>
          <p className="text-muted-sm">{subtitle}</p>
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─────────────── TABLA EMPLEADOS ─────────────── */
function EmpleadosTable({ rows }: { rows: EmpleadoFila[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibles = showAll ? rows : rows.slice(0, 8);
  const maxHoras = Math.max(...rows.map(r => r.horas_trabajadas), 1);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="heading-3">Por empleado</h2>
          <p className="text-muted-sm" style={{ marginTop: 2 }}>{rows.length} empleado{rows.length !== 1 ? "s" : ""} con actividad</p>
        </div>
        {rows.length > 8 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(v => !v)}>
            {showAll ? "Ver menos" : `Ver todos (${rows.length})`}
          </button>
        )}
      </div>
      {visibles.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin actividad</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th style={{ width: 100 }}>Registros</th>
              <th style={{ width: 130 }}>Puntualidad</th>
              <th style={{ width: 220 }}>Horas trabajadas</th>
              <th style={{ width: 150 }}>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => {
              const pct = maxHoras > 0 ? (r.horas_trabajadas / maxHoras) * 100 : 0;
              return (
                <tr key={r.empleado_id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9,
                        background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#60a5fa", flexShrink: 0,
                      }}>
                        {r.nombre[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{r.nombre}</span>
                    </div>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", fontSize: 13 }}>{r.registros}</td>
                  <td>
                    {r.llegadas_tarde === 0
                      ? <span className="badge badge-success">Puntual</span>
                      : <span className="badge badge-warn">{r.llegadas_tarde} {r.llegadas_tarde === 1 ? "tarde" : "tardes"}</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: r.horas_trabajadas > 0 ? "var(--text-primary)" : "var(--text-faint)", minWidth: 36 }}>
                        {r.horas_trabajadas > 0 ? `${r.horas_trabajadas.toFixed(1)}h` : "—"}
                      </span>
                      {r.horas_trabajadas > 0 && (
                        <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, #22c55e, #4ade80)`, borderRadius: 3, transition: "width 400ms ease" }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-muted)" }}>
                    {r.ultima_actividad
                      ? new Date(r.ultima_actividad).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─────────────── TABLA REGISTROS ─────────────── */
const PAGE_SIZE = 50;

function RegistrosTable({ rows }: { rows: ReportesData["registros"] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <h2 className="heading-3">Registros detallados</h2>
          <p className="text-muted-sm" style={{ marginTop: 2 }}>{rows.length} registro{rows.length === 1 ? "" : "s"} en el rango</p>
        </div>
        <span className="badge badge-neutral">Página {safePage + 1} / {totalPages}</span>
      </div>
      {slice.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin registros</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Fecha · Hora</th>
                <th>Empleado</th>
                <th style={{ width: 180 }}>Sucursal</th>
                <th style={{ width: 110 }}>Tipo</th>
                <th style={{ width: 110 }}>Confianza</th>
              </tr>
            </thead>
            <tbody>
              {slice.map(r => (
                <tr key={r.id}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {new Date(r.timestamp).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>{r.empleado_nombre ?? "—"}</td>
                  <td>{r.sucursal_nombre ?? "—"}</td>
                  <td>
                    {r.tipo === "entrada"
                      ? <span className="badge badge-success">Entrada</span>
                      : <span className="badge badge-info">Salida</span>}
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

/* ─────────────── HELPERS ─────────────── */
function todayString(): string {
  return isoDate(new Date());
}
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function granularityLabel(g: Granularidad): string {
  if (g === "mes")    return "Asistencia mensual";
  if (g === "semana") return "Asistencia semanal";
  return "Asistencia diaria";
}
