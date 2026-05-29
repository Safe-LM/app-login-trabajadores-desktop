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
import { PageHeader } from "@/components/ui/PageHeader";
import { Printer, Clock, AlertTriangle, Smile, BarChart2 } from "lucide-react";

const CHART_COLORS = ["#3B82F6", "#60A5FA", "#93C5FD", "#22c55e", "#eab308", "#f87171", "#a78bfa", "#f472b6"];

const GLOBAL_CSS = `
  @media screen {
    .no-screen {
      display: none !important;
    }
  }

  @media print {
    @page {
      size: letter portrait;
      margin: 15mm 15mm 15mm 15mm;
    }

    body, html, :root {
      --bg-black: #ffffff !important;
      --bg-card: #ffffff !important;
      --bg-elevated: #f8fafc !important;
      --border: #e2e8f0 !important;
      --border-strong: #cbd5e1 !important;
      --text-primary: #0f172a !important;
      --text-secondary: #334155 !important;
      --text-muted: #64748b !important;
      --text-faint: #94a3b8 !important;
      background: white !important;
      color: #0f172a !important;
    }

    /* Ocultar elementos no imprimibles */
    .no-print,
    .btn,
    .filter-bar,
    .page-header-actions,
    nav,
    aside,
    header,
    footer,
    button,
    input,
    select,
    .dashboard-shell > *:not(.dashboard-main-col),
    .dashboard-main-col > *:not(main),
    .dashboard-topbar {
      display: none !important;
    }

    /* Reset del layout de Next.js/Dashboard para impresión */
    body, html, .dashboard-shell, .dashboard-main-col, .dashboard-main, main, .page {
      background: white !important;
      color: #0f172a !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }

    .print-only {
      display: block !important;
    }

    /* Colores oscuros legibles para texto */
    h1, h2, h3, h4, p, span, td, th {
      color: #0f172a !important;
    }

    /* Formatear tarjetas para papel */
    .card {
      background: white !important;
      border: 1px solid #e2e8f0 !important;
      border-top: 3px solid var(--kpi-color, #2563eb) !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      margin-bottom: 20px !important;
      padding: 16px !important;
      border-radius: 8px !important;
    }

    /* Ajustes de tabla */
    .data-table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
    }
    .data-table tr {
      page-break-inside: avoid !important;
      page-break-after: auto !important;
    }
    .data-table th {
      background: #1e3a8a !important; /* Azul corporativo */
      color: #ffffff !important;      /* Texto blanco */
      border-bottom: 2px solid #172554 !important;
      padding: 8px 12px !important;
      font-size: 9.5px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
    }
    .data-table td {
      border-bottom: 1px solid #cbd5e1 !important;
      padding: 8px 12px !important;
      font-size: 10.5px !important;
      color: #334155 !important;
    }
    /* Zebra striping en print */
    .data-table tbody tr:nth-child(even) td {
      background-color: #f8fafc !important;
    }

    /* Grid de KPIs a 3 columnas simétricas */
    .kpi-grid-container {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 12px !important;
      margin-bottom: 20px !important;
    }

    /* Gráficos en dos columnas */
    .reportes-charts-grid {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 16px !important;
      margin-bottom: 20px !important;
      page-break-inside: avoid !important;
    }

    /* Ajustes de color para texto de gráficos en print */
    .recharts-text, svg text, .recharts-legend-item-text {
      fill: #334155 !important;
      color: #334155 !important;
      font-size: 10px !important;
      font-weight: 500 !important;
    }
    .recharts-cartesian-grid line {
      stroke: #e2e8f0 !important;
      stroke-opacity: 0.8 !important;
    }

    /* Salto de página para separar el resumen ejecutivo del desglose detallado */
    .page-break {
      page-break-before: always !important;
      break-before: page !important;
      height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }

    /* Mostrar todos los registros ocultos en print */
    .no-screen {
      display: table-row !important;
    }

    /* Estilo del avatar del colaborador en print */
    .colab-avatar {
      border: 1px solid #cbd5e1 !important;
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }
  }
`;

export function ReportesClient({
  data,
  empresaNombre = "Safe Link"
}: {
  data: ReportesData;
  empresaNombre?: string;
}) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="page">
      {/* Cabecera de Página Profesional */}
      <div className="no-print">
        <PageHeader
          title="Reportes"
          subtitle="Análisis de asistencia y puntualidad"
          icon={<BarChart2 size={20} />}
          iconColor="#14b8a6"
          stats={[
            { label: "Registros", value: report.registrosFiltrados.length },
            { label: "Horas Totales", value: `${report.kpis.horasTrabajadas.toFixed(1)}h` },
          ]}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <ExportButton
                getRows={() => report.registrosFiltrados.map((r) => ({
                  Fecha: new Date(r.timestamp).toLocaleDateString("es-MX"),
                  Hora:  new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                  Empleado: r.empleado_nombre ?? "",
                  Sucursal: r.sucursal_nombre ?? "",
                  Tipo: r.tipo,
                  Confianza: r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "",
                }))}
                filenamePrefix={`reporte_asistencia_${filtros.desde}_${filtros.hasta}`}
                sheetName="Reporte de Asistencia"
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={13} />
                <span>Exportar PDF</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Guía Rápida Informativa */}
      <div className="card no-print" style={{
        padding: "14px 20px",
        background: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(37,99,235,0.03) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderRadius: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Smile size={16} style={{ color: "var(--teal)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            ¿Cómo entender este reporte?
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Este panel calcula estadísticas de asistencia basadas en el rango de fechas y filtros seleccionados. Las métricas de <strong>Asistencia</strong> y <strong>Puntualidad</strong> consideran los horarios y tolerancias de cada sucursal. Los días laborables sin marcas se estiman como <strong>Ausencias</strong> teóricas de los empleados activos.
        </p>
      </div>

      {/* Membrete corporativo exclusivo para impresión PDF */}
      <PrintHeader
        filtros={filtros}
        sucursales={data.sucursales}
        empleados={data.empleados}
        empresaNombre={empresaNombre}
        totalRegistros={report.registrosFiltrados.length}
        totalEmpleados={report.porEmpleado.length}
      />

      {/* Barra de Filtros */}
      <FilterBar
        filtros={filtros}
        setFiltro={setFiltro}
        setFiltros={setFiltros}
        granularidad={granularidad}
        setGranularidad={setGranularidad}
        sucursales={data.sucursales}
        empleados={empleadosVisibles}
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

      {/* KPIs Grid */}
      <KpiGrid kpis={report.kpis} sinHorario={sinHorario || sinSucursalEnRegistros} />

      {/* Gráficos */}
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

      {/* Salto de página para separar el resumen ejecutivo del desglose detallado */}
      <div className="page-break" />

      {/* Cabecera del Desglose Detallado en Impresión */}
      <div className="print-only" style={{ display: "none", marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0f172a", borderBottom: "2px solid #cbd5e1", paddingBottom: 6 }}>
          Desglose Analítico por Colaborador e Historial de Registros
        </h2>
      </div>

      {/* Tablas de resultados */}
      <div className="card-print-avoid">
        <EmpleadosTable rows={report.porEmpleado} diasEnRango={report.kpis.diasEnRango} />
      </div>

      <div className="card-print-avoid">
        <RegistrosTable rows={report.registrosFiltrados} />
      </div>

      {/* Bloque de Firmas Oficial (Solo Impresión) */}
      <div className="print-only" style={{ display: "none", marginTop: 48, pageBreakInside: "avoid" }}>
        {/* Párrafo de descargo de responsabilidad */}
        <p style={{
          fontSize: 9.5,
          fontStyle: "italic",
          lineHeight: 1.5,
          color: "#475569",
          borderTop: "1px solid #cbd5e1",
          paddingTop: 12,
          marginBottom: 30
        }}>
          <strong>Declaración de Conformidad:</strong> La información contenida en este reporte constituye un registro fidedigno de la puntualidad y asistencia laboral en <strong>{empresaNombre}</strong>. Los datos han sido validados biométricamente mediante el software de control biométrico facial y se consideran definitivos para fines administrativos, contables y de auditoría interna de la organización.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
          marginTop: 20
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #475569", width: "80%", margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#1e3a8a", margin: 0 }}>
              Firma de Administrador / RRHH
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0 0" }}>
              Nombre: ___________________________
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "2px 0 0 0" }}>
              Fecha: ____/____/________
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1.5px solid #475569", width: "80%", margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#1e3a8a", margin: 0 }}>
              Firma de Dirección General
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "4px 0 0 0" }}>
              Nombre: ___________________________
            </p>
            <p style={{ fontSize: 9, color: "#475569", margin: "2px 0 0 0" }}>
              Fecha: ____/____/________
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 40,
          borderTop: "1px solid #cbd5e1",
          paddingTop: 12,
          textAlign: "center",
          fontSize: 9,
          color: "#94a3b8"
        }}>
          Este reporte es un documento oficial e inalterable generado por la plataforma Safe Link Monitoring para {empresaNombre}.
          Toda la información ha sido registrada biométricamente y cifrada bajo estándares criptográficos.
        </div>
      </div>

      {/* Inyección de estilos de impresión globales */}
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.reportes-charts-grid) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────── PRINT HEADER ─────────────── */
function PrintHeader({
  filtros, sucursales, empleados, empresaNombre, totalRegistros, totalEmpleados
}: {
  filtros: Filtros;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
  empresaNombre: string;
  totalRegistros: number;
  totalEmpleados: number;
}) {
  const sucursalNombre = filtros.sucursalId === "all"
    ? "Todas las sucursales"
    : sucursales.find(s => s.id === filtros.sucursalId)?.nombre || "Desconocida";

  const empleadoNombre = filtros.empleadoId === "all"
    ? "Todos los colaboradores"
    : empleados.find(e => e.id === filtros.empleadoId)?.nombre || "Desconocido";

  const fechaGeneracion = new Date().toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short"
  });

  return (
    <div className="print-only" style={{ display: "none" }}>
      {/* Línea de acento de marca en la parte superior del PDF */}
      <div style={{ height: 4, background: "#1e3a8a", marginBottom: 20, borderRadius: 2 }} />

      {/* Encabezado Principal de Membrete Corporativo */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        borderBottom: "3px solid #1e3a8a",
        paddingBottom: 16,
        marginBottom: 20
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15
            }}>
              S
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#1e3a8a", letterSpacing: "-0.03em" }}>
              {empresaNombre.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: 9.5, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            REPORTE DE ASISTENCIA Y PUNTUALIDAD · SISTEMA DE CONTROL BIOMÉTRICO
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{
            background: "#1e3a8a",
            border: "1px solid #172554",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 9,
            fontWeight: 700,
            color: "#ffffff"
          }}>
            DOCUMENTO OFICIAL
          </span>
        </div>
      </div>

      {/* Párrafo Introductorio Ejecutivo */}
      <p style={{
        fontSize: 10.5,
        lineHeight: 1.6,
        color: "#334155",
        margin: "0 0 20px 0",
        padding: "12px 16px",
        background: "#f8fafc",
        borderLeft: "4px solid #1e3a8a",
        borderRadius: "0 8px 8px 0"
      }}>
        Este documento constituye un informe oficial consolidado de control de asistencia y puntualidad para la organización <strong>{empresaNombre}</strong>. Los registros y métricas presentados corresponden al periodo del <strong>{filtros.desde}</strong> al <strong>{filtros.hasta}</strong>, recopilados mediante estaciones de autenticación biométrica facial. Toda la información ha sido debidamente procesada para validar horas netas laboradas y puntualidades relativas a cada sucursal configurada.
      </p>

      {/* Ficha Técnica / Metadatos del Reporte */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 16,
        marginBottom: 24,
        fontSize: 11,
        color: "#1f2937"
      }}>
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e3a8a", margin: "0 0 8px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Detalles de la Consulta
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280", width: "35%" }}><strong>Rango de Fechas:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{filtros.desde} al {filtros.hasta}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Sucursal:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{sucursalNombre}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Colaborador:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{empleadoNombre}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1e3a8a", margin: "0 0 8px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: 4 }}>
            Ficha de Emisión
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280", width: "35%" }}><strong>Fecha Emisión:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{fechaGeneracion}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Registros y Empleados:</strong></td>
                <td style={{ padding: "3px 0", color: "#111827" }}>{totalRegistros} marcas · {totalEmpleados} colaboradores</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>ID de Auditoría:</strong></td>
                <td style={{ padding: "3px 0", color: "#475569", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                  {empresaNombre.slice(0, 3).toUpperCase()}-{new Date(filtros.desde).getTime().toString().slice(-4)}-{totalRegistros}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", color: "#6b7280" }}><strong>Validez:</strong></td>
                <td style={{ padding: "3px 0", color: "#10b981", fontWeight: 700, fontSize: 10 }}>COTEJADO BIOMÉTRICAMENTE</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── FILTROS ─────────────── */
function FilterBar({
  filtros, setFiltro, setFiltros, granularidad, setGranularidad,
  sucursales, empleados, rangeDays,
}: {
  filtros: Filtros;
  setFiltro: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void;
  setFiltros: React.Dispatch<React.SetStateAction<Filtros>>;
  granularidad: Granularidad;
  setGranularidad: (g: Granularidad) => void;
  sucursales: ReportesData["sucursales"];
  empleados: ReportesData["empleados"];
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
    <div className="card filter-bar no-print" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
        <Field label="Desde">
          <input type="date" className="input" value={filtros.desde} min={minDate} max={filtros.hasta}
            onChange={e => setFiltro("desde", e.target.value)} style={{ colorScheme: "dark", height: 38 }} />
        </Field>
        <Field label="Hasta">
          <input type="date" className="input" value={filtros.hasta} min={filtros.desde} max={today}
            onChange={e => setFiltro("hasta", e.target.value)} style={{ colorScheme: "dark", height: 38 }} />
        </Field>
        <Field label="Sucursal">
          <select className="input" value={filtros.sucursalId} style={{ height: 38, padding: "0 10px", colorScheme: "dark" }}
            onChange={e => setFiltro("sucursalId", e.target.value as Filtros["sucursalId"])}>
            <option value="all">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id} style={{ background: "var(--bg-elevated)" }}>{s.nombre}</option>)}
          </select>
        </Field>
        <Field label="Empleado">
          <select className="input" value={filtros.empleadoId} style={{ height: 38, padding: "0 10px", colorScheme: "dark" }}
            onChange={e => setFiltro("empleadoId", e.target.value as Filtros["empleadoId"])}>
            <option value="all">Todos los colaboradores</option>
            {empleados.map(e => <option key={e.id} value={e.id} style={{ background: "var(--bg-elevated)" }}>{e.nombre}</option>)}
          </select>
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

  type Item = { key: string; label: string; value: string; sub: string; desc: string; tone?: "good" | "warn" | "bad"; noData?: boolean };
  const items: Item[] = [
    { key: "registros",  label: "Total registros",   value: String(kpis.totalRegistros), sub: `${kpis.diasEnRango} día${kpis.diasEnRango !== 1 ? "s" : ""} en rango`, desc: "Eventos totales de entrada y salida procesados." },
    { key: "asistencia", label: "Asistencia",         value: `${kpis.asistenciasRealizadas}/${kpis.asistenciasEsperadas}`, sub: `${kpis.pctAsistencia}% del esperado`, tone: kpis.pctAsistencia >= 80 ? "good" : kpis.pctAsistencia >= 60 ? "warn" : "bad", desc: "Días asistidos frente a laborales teóricos." },
    { key: "puntual",    label: "Puntualidad",        value: sinHorario ? "—" : `${kpis.pctPuntualidad}%`, sub: sinHorario ? "Sin horario configurado" : `${kpis.llegadasTarde} llegada${kpis.llegadasTarde !== 1 ? "s" : ""} tarde`, tone: sinHorario ? undefined : kpis.pctPuntualidad >= 90 ? "good" : kpis.pctPuntualidad >= 70 ? "warn" : "bad", noData: sinHorario, desc: "Entradas dentro de la tolerancia de sucursal." },
    { key: "ausencias",  label: "Ausencias",          value: String(kpis.ausencias), sub: `${kpis.empleadosActivos} empleado${kpis.empleadosActivos !== 1 ? "s" : ""} activos`, tone: kpis.ausencias === 0 ? "good" : kpis.ausencias > kpis.asistenciasEsperadas / 4 ? "bad" : "warn", desc: "Días hábiles teóricos sin marca de asistencia." },
    { key: "horas",      label: "Horas trabajadas",   value: kpis.horasTrabajadas > 0 ? `${kpis.horasTrabajadas.toFixed(1)}h` : "—", sub: kpis.horasTrabajadas > 0 ? `~${horasPromDia}h promedio/día` : "Sin pares entrada/salida", desc: "Horas acumuladas entre entradas y salidas consecutivas." },
    { key: "confianza",  label: "Confianza facial",   value: `${kpis.confianzaPromedio}%`, sub: "promedio del rango", tone: kpis.confianzaPromedio >= 85 ? "good" : kpis.confianzaPromedio >= 70 ? "warn" : kpis.confianzaPromedio > 0 ? "bad" : undefined, desc: "Precisión media de reconocimiento biométrico." },
  ];

  const toneColor = { good: "#22c55e", warn: "#eab308", bad: "#ef4444" };

  return (
    <div className="kpi-grid-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
      {items.map(it => {
        const color = it.noData ? "rgba(255,255,255,0.25)" : it.tone ? toneColor[it.tone] : "var(--text-faint)";
        const printColor = it.noData ? "#cbd5e1" : it.tone ? toneColor[it.tone] : "#2563eb";
        return (
          <div key={it.key} className="card" style={{
            padding: 16,
            position: "relative",
            overflow: "hidden",
            "--kpi-color": printColor
          } as React.CSSProperties}>
            {it.tone && !it.noData && (
              <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${toneColor[it.tone]}, transparent)`, opacity: 0.6 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{it.label}</p>
              <span style={{ color, opacity: 0.7 }} title={it.desc}>{KPI_ICONS[it.key]}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, color: it.noData ? "rgba(255,255,255,0.25)" : "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", margin: 0 }}>
              {it.value}
            </p>
            <p style={{ fontSize: 11, color: it.noData ? "rgba(255,255,255,0.2)" : "var(--text-muted)", marginTop: 6, marginBottom: 2, fontWeight: 600 }}>
              {it.sub}
            </p>
            <p style={{ fontSize: 9.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.3 }} className="no-print">
              {it.desc}
            </p>
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
function EmpleadosTable({ rows, diasEnRango }: { rows: EmpleadoFila[]; diasEnRango: number }) {
  const [showAll, setShowAll] = useState(false);
  const maxHoras = Math.max(...rows.map(r => r.horas_trabajadas), 1);
  const totalHoras = rows.reduce((a, r) => a + r.horas_trabajadas, 0);
  const totalTardes = rows.reduce((a, r) => a + r.llegadas_tarde, 0);
  const sinDatos = totalHoras === 0;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="heading-3" style={{ marginBottom: 2 }}>Por empleado</h2>
          <p className="text-muted-sm">{rows.length} empleado{rows.length !== 1 ? "s" : ""} con actividad en el rango</p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {sinDatos && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
              Sin pares entrada/salida en el rango
            </span>
          )}
          {!sinDatos && totalHoras > 0 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Total · {diasEnRango} día{diasEnRango !== 1 ? "s" : ""}
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>{totalHoras.toFixed(1)}h</p>
            </div>
          )}
          {totalTardes > 0 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tardanzas</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>{totalTardes}</p>
            </div>
          )}
          {rows.length > 8 && (
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => setShowAll(v => !v)}>
              {showAll ? "Ver menos" : `+${rows.length - 8} más`}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin actividad</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th style={{ width: "80px" }}>Scans</th>
                <th style={{ width: "160px" }}>Puntualidad</th>
                <th style={{ width: "240px" }}>Horas trabajadas</th>
                <th style={{ width: "180px" }}>Último scan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => {
                const isHiddenOnScreen = !showAll && index >= 8;
                const maxHorasVal = maxHoras;
                const pct = maxHorasVal > 0 ? (r.horas_trabajadas / maxHorasVal) * 100 : 0;
                const tieneHoras = r.horas_trabajadas > 0;

                let hash = 0;
                const name = r.nombre;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                const h = Math.abs(hash % 360);
                const avatarBg = `hsl(${h}, 50%, 15%)`;
                const avatarColor = `hsl(${h}, 70%, 75%)`;
                const inicial = r.nombre[0]?.toUpperCase() ?? "?";

                return (
                  <tr key={r.empleado_id} className={isHiddenOnScreen ? "no-screen" : ""}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div className="colab-avatar" style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: avatarBg, border: `1px solid ${avatarColor}33`,
                          display: "flex", alignItems: "center",
                          fontSize: 12, fontWeight: 700, color: avatarColor,
                          justifyContent: "center"
                        }}>
                          {inicial}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "block" }}>
                            {r.nombre}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 1 }}>
                            {tieneHoras ? `${r.horas_trabajadas.toFixed(1)}h en ${diasEnRango}d` : `${r.registros} scan${r.registros !== 1 ? "s" : ""} · sin salidas`}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--text-primary)" }}>
                      {r.registros}
                    </td>

                    <td>
                      {r.llegadas_tarde === 0 ? (
                        <span className="badge badge-success" style={{ fontSize: 11 }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
                          Puntual
                        </span>
                      ) : (
                        <span className="badge badge-warn" style={{ fontSize: 11 }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
                          {r.llegadas_tarde} tarde{r.llegadas_tarde !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>

                    <td>
                      {tieneHoras ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", minWidth: 38 }}>
                            {r.horas_trabajadas.toFixed(1)}h
                          </span>
                          <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", minWidth: 80 }} className="no-print">
                            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${avatarColor}aa, ${avatarColor})`, borderRadius: 3 }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Pendiente salida</span>
                      )}
                    </td>

                    <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", fontSize: 11 }}>
                      {r.ultima_actividad
                        ? new Date(r.ultima_actividad).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────── TABLA REGISTROS ─────────────── */
const PAGE_SIZE = 50;
const PRINT_LIMIT = 300;

function RegistrosTable({ rows }: { rows: ReportesData["registros"] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  // Renderizar registros hasta el límite de impresión (300) y esconder los de otras páginas
  // de forma que en pantalla se vea paginado pero en papel imprima completo
  const printRows = rows.slice(0, PRINT_LIMIT);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <h2 className="heading-3">Registros detallados</h2>
          <p className="text-muted-sm" style={{ marginTop: 2 }}>
            {rows.length} registro{rows.length === 1 ? "" : "s"} en el rango
            {rows.length > PRINT_LIMIT && (
              <span className="no-print" style={{ color: "var(--yellow)", marginLeft: 6 }}>
                (Se imprimirán los primeros {PRINT_LIMIT})
              </span>
            )}
          </p>
          {rows.length > PRINT_LIMIT && (
            <p className="print-only" style={{ display: "none", fontSize: 10, color: "#ef4444", margin: "4px 0 0 0", fontWeight: 600 }}>
              ⚠️ Nota: Este reporte impreso muestra un máximo de {PRINT_LIMIT} registros. Filtre por empleado o sucursal para mayor detalle.
            </p>
          )}
        </div>
        <span className="badge badge-neutral">Página {safePage + 1} / {totalPages}</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state" style={{ borderRadius: 0, border: "none", padding: "40px 20px" }}>
          <p className="heading-3">Sin registros</p>
          <p className="text-muted-sm">Ajusta los filtros para ver registros.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
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
                {printRows.map((r, index) => {
                  const isCurrentPage = index >= safePage * PAGE_SIZE && index < (safePage + 1) * PAGE_SIZE;
                  const isHiddenOnScreen = !isCurrentPage;
                  const rowClass = isHiddenOnScreen ? "no-screen" : "";

                  return (
                    <tr key={r.id} className={rowClass}>
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
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="no-print" style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
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
