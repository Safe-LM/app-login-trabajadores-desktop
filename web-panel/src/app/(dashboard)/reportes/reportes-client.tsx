"use client";
import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { computeReport, toCsv } from "./compute";
import type { ComputedReport, EmpleadoFila } from "./compute";
import type { Filtros, Granularidad, ReportesData } from "./types";

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
  const [granularidad, setGranularidad] = useState<Granularidad>("dia");

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

  function exportCsv() {
    const csv = toCsv(report.registrosFiltrados);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_asistencia_${filtros.desde}_${filtros.hasta}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <FilterBar
        filtros={filtros}
        setFiltro={setFiltro}
        granularidad={granularidad}
        setGranularidad={setGranularidad}
        sucursales={data.sucursales}
        empleados={empleadosVisibles}
        onExport={exportCsv}
        rangeDays={data.rangeDays}
      />

      <KpiGrid kpis={report.kpis} />

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)" }} className="reportes-charts-grid">
        <ChartCard title="Actividad" subtitle={granularityLabel(granularidad)}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={report.serieTiempo}>
              <defs>
                <linearGradient id="entradasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salidasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#0a0a0b", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
              <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="url(#entradasGrad)" name="Entradas" />
              <Area type="monotone" dataKey="salidas" stroke="#3b82f6" strokeWidth={2} fill="url(#salidasGrad)" name="Salidas" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por sucursal" subtitle={`${report.porSucursal.length} sucursal${report.porSucursal.length === 1 ? "" : "es"}`}>
          {report.porSucursal.length === 0 ? (
            <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
              Sin registros en el rango seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={report.porSucursal} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                  {report.porSucursal.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0a0a0b", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 12 }}
                />
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
  filtros, setFiltro, granularidad, setGranularidad,
  sucursales, empleados, onExport, rangeDays,
}: {
  filtros: Filtros;
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void;
  granularidad: Granularidad;
  setGranularidad: (g: Granularidad) => void;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
  onExport: () => void;
  rangeDays: number;
}) {
  const minDate = isoDate(daysAgo(rangeDays));
  const maxDate = todayString();

  return (
    <div className="card" style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end" }}>
      <Field label="Desde">
        <input
          type="date"
          className="input"
          value={filtros.desde}
          min={minDate}
          max={filtros.hasta}
          onChange={e => setFiltro("desde", e.target.value)}
          style={{ colorScheme: "dark" }}
        />
      </Field>
      <Field label="Hasta">
        <input
          type="date"
          className="input"
          value={filtros.hasta}
          min={filtros.desde}
          max={maxDate}
          onChange={e => setFiltro("hasta", e.target.value)}
          style={{ colorScheme: "dark" }}
        />
      </Field>
      <Field label="Sucursal">
        <select
          className="input"
          value={filtros.sucursalId}
          onChange={e => setFiltro("sucursalId", e.target.value as Filtros["sucursalId"])}
        >
          <option value="all">Todas las sucursales</option>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </Field>
      <Field label="Empleado">
        <select
          className="input"
          value={filtros.empleadoId}
          onChange={e => setFiltro("empleadoId", e.target.value as Filtros["empleadoId"])}
        >
          <option value="all">Todos los empleados</option>
          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </Field>
      <Field label="Granularidad">
        <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
          {(["dia", "semana", "mes"] as Granularidad[]).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularidad(g)}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 6,
                background: granularidad === g ? "var(--accent)" : "transparent",
                border: "none", cursor: "pointer",
                color: granularidad === g ? "#fff" : "var(--text-muted)",
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                textTransform: "capitalize", transition: "all 150ms",
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Exportar">
        <button type="button" className="btn btn-secondary" onClick={onExport} style={{ width: "100%", justifyContent: "center" }}>
          <DownloadIcon /> CSV
        </button>
      </Field>
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
function KpiGrid({ kpis }: { kpis: ComputedReport["kpis"] }) {
  const items: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }[] = [
    { label: "Total registros", value: String(kpis.totalRegistros), sub: `${kpis.diasEnRango} días en rango` },
    { label: "Asistencias", value: `${kpis.asistenciasRealizadas}/${kpis.asistenciasEsperadas}`, sub: `${kpis.pctAsistencia}% del esperado`, tone: kpis.pctAsistencia >= 80 ? "good" : kpis.pctAsistencia >= 60 ? "warn" : "bad" },
    { label: "Puntualidad", value: `${kpis.pctPuntualidad}%`, sub: `${kpis.llegadasTarde} llegadas tarde`, tone: kpis.pctPuntualidad >= 90 ? "good" : kpis.pctPuntualidad >= 70 ? "warn" : "bad" },
    { label: "Ausencias", value: String(kpis.ausencias), sub: `${kpis.empleadosActivos} empleados`, tone: kpis.ausencias === 0 ? "good" : kpis.ausencias > kpis.asistenciasEsperadas / 4 ? "bad" : "warn" },
    { label: "Horas trabajadas", value: kpis.horasTrabajadas.toFixed(1), sub: "pares entrada/salida" },
    { label: "Confianza facial", value: `${kpis.confianzaPromedio}%`, sub: "promedio del rango" },
  ];

  const toneToColor: Record<NonNullable<typeof items[number]["tone"]>, string> = {
    good: "#22c55e", warn: "#eab308", bad: "#ef4444",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      {items.map(it => (
        <div key={it.label} className="card" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
          {it.tone && (
            <span style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${toneToColor[it.tone]}, transparent)`,
              opacity: 0.5,
            }} />
          )}
          <p className="text-eyebrow" style={{ marginBottom: 6, color: it.tone ? toneToColor[it.tone] : undefined }}>{it.label}</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {it.value}
          </p>
          {it.sub && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{it.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/* ─────────────── CHART CARD ─────────────── */
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 className="heading-3">{title}</h3>
        <p className="text-muted-sm" style={{ marginTop: 2 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/* ─────────────── TABLA EMPLEADOS ─────────────── */
function EmpleadosTable({ rows }: { rows: EmpleadoFila[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibles = showAll ? rows : rows.slice(0, 8);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="heading-3">Por empleado</h2>
          <p className="text-muted-sm" style={{ marginTop: 2 }}>{rows.length} empleados con actividad</p>
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
              <th style={{ width: 120 }}>Registros</th>
              <th style={{ width: 140 }}>Llegadas tarde</th>
              <th style={{ width: 140 }}>Horas trabajadas</th>
              <th style={{ width: 160 }}>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(r => (
              <tr key={r.empleado_id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "rgba(37,99,235,0.12)",
                      border: "1px solid rgba(37,99,235,0.22)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#60a5fa", flexShrink: 0,
                    }}>
                      {r.nombre[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.nombre}</span>
                  </div>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.registros}</td>
                <td>
                  {r.llegadas_tarde === 0
                    ? <span className="badge badge-success">Puntual</span>
                    : <span className="badge badge-warn">{r.llegadas_tarde} {r.llegadas_tarde === 1 ? "tarde" : "tardes"}</span>}
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.horas_trabajadas.toFixed(1)}h</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.ultima_actividad
                    ? new Date(r.ultima_actividad).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
              </tr>
            ))}
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
