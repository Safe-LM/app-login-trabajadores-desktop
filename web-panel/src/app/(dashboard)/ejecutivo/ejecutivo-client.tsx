"use client";

import { useMemo, useState } from "react";
import {
  Building2, TrendingUp, TrendingDown, Users, Clock, Edit3, Trophy,
  Activity, Award, ShieldAlert, Search, Sparkles
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

type KPI = {
  sucursal_id: string;
  empresa_id: string;
  sucursal_nombre: string;
  zona: string | null;
  ciudad: string | null;
  activa: boolean;
  total_entradas: number;
  total_salidas: number;
  marcaciones_manuales: number;
  empleados_activos: number;
  dias_con_actividad: number;
  ratio_puntualidad: number;       // 0-1
  hora_promedio_entrada: number | null;
};

export function EjecutivoClient({ kpis }: { kpis: KPI[] }) {
  const activos = useMemo(() => kpis.filter((k) => k.activa), [kpis]);
  const totales = useMemo(() => {
    const activeKpis = activos;
    return {
      sucursales: activeKpis.length,
      entradas:   activeKpis.reduce((s, k) => s + k.total_entradas, 0),
      empleados:  Math.max(...activeKpis.map((k) => k.empleados_activos), 0),
      manuales:   activeKpis.reduce((s, k) => s + k.marcaciones_manuales, 0),
    };
  }, [activos]);

  // Ranking de puntualidad (descendente)
  const rankingPuntualidad = useMemo(
    () => [...activos]
      .filter((k) => k.total_entradas > 0)
      .sort((a, b) => b.ratio_puntualidad - a.ratio_puntualidad),
    [activos]
  );

  // Estados de control interactivo
  const [search, setSearch] = useState("");
  const [selectedCiudad, setSelectedCiudad] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("puntualidad-desc");

  // Lista única de ciudades para el filtro
  const ciudades = useMemo(() => {
    const list = new Set<string>();
    kpis.forEach((k) => {
      if (k.ciudad) list.add(k.ciudad);
    });
    return Array.from(list).sort();
  }, [kpis]);

  // Lista filtrada y ordenada
  const filteredKpis = useMemo(() => {
    let result = [...activos];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (k) =>
          k.sucursal_nombre.toLowerCase().includes(q) ||
          (k.ciudad && k.ciudad.toLowerCase().includes(q))
      );
    }

    if (selectedCiudad !== "all") {
      result = result.filter((k) => k.ciudad === selectedCiudad);
    }

    result.sort((a, b) => {
      if (sortBy === "puntualidad-desc") {
        return b.ratio_puntualidad - a.ratio_puntualidad;
      }
      if (sortBy === "puntualidad-asc") {
        return a.ratio_puntualidad - b.ratio_puntualidad;
      }
      if (sortBy === "entradas-desc") {
        return b.total_entradas - a.total_entradas;
      }
      if (sortBy === "entradas-asc") {
        return a.total_entradas - b.total_entradas;
      }
      if (sortBy === "manuales-desc") {
        return b.marcaciones_manuales - a.marcaciones_manuales;
      }
      if (sortBy === "empleados-desc") {
        return b.empleados_activos - a.empleados_activos;
      }
      return 0;
    });

    return result;
  }, [activos, search, selectedCiudad, sortBy]);

  return (
    <div className="page animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Breadcrumbs crumbs={[{ label: "Dashboard ejecutivo" }]} />
      <PageHeader
        title="Dashboard ejecutivo"
        subtitle="Comparativa de rendimiento entre sucursales · últimos 30 días"
        icon={<Building2 size={20} />}
        iconColor="#8b5cf6"
        stats={[
          { label: "Sucursales", value: totales.sucursales },
          { label: "Entradas",   value: totales.entradas.toLocaleString("es-MX") },
          { label: "Empleados",  value: totales.empleados },
          { label: "Manuales",   value: totales.manuales },
        ]}
        actions={
          <ExportButton
            filenamePrefix="kpis_sucursales"
            sheetName="KPIs"
            getRows={() => kpis.map((k) => ({
              Sucursal: k.sucursal_nombre,
              Ciudad: k.ciudad ?? "",
              Activa: k.activa ? "Sí" : "No",
              Entradas: k.total_entradas,
              Salidas: k.total_salidas,
              "Marcaciones manuales": k.marcaciones_manuales,
              "Empleados activos": k.empleados_activos,
              "Días con actividad": k.dias_con_actividad,
              "Puntualidad %": Math.round(k.ratio_puntualidad * 100),
              "Hora promedio entrada": k.hora_promedio_entrada
                ? k.hora_promedio_entrada.toFixed(1)
                : "—",
            }))}
          />
        }
      />

      {activos.length === 0 ? (
        <EmptyState
          icon={Building2}
          tone="violet"
          title="Sin sucursales activas"
          description="Crea al menos una sucursal y registra asistencias para ver KPIs comparados."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          
          {/* Fila superior: Ranking + Resumen de Operaciones + Sugerencias Inteligentes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {rankingPuntualidad.length > 0 && (
              <RankingCard
                title="Ranking de Puntualidad"
                subtitle="Sucursales más puntuales (30 días)"
                icon={<Trophy size={16} />}
                items={rankingPuntualidad.slice(0, 5).map((k, i) => ({
                  rank: i + 1,
                  label: k.sucursal_nombre,
                  percentage: Math.round(k.ratio_puntualidad * 100),
                  hint: `${k.total_entradas} entradas · ${k.empleados_activos} colaboradores`,
                  color: k.ratio_puntualidad >= 0.8 ? "var(--green)"
                       : k.ratio_puntualidad >= 0.6 ? "var(--yellow)"
                       : "var(--red)",
                }))}
              />
            )}

            <OperationsSummaryCard totales={totales} />

            <ExecutiveInsightsCard kpis={activos} />
          </div>

          {/* Gráfico Analítico de Comparación */}
          <ExecutiveBarChart data={activos} />

          {/* Sección de Tarjetas Detalladas por Sucursal */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <h2 className="heading-2" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, margin: 0 }}>
                <Activity size={16} style={{ color: "#8b5cf6" }} />
                <span>Desglose Operativo por Sucursal</span>
              </h2>
            </div>

            {/* Barra de Filtros e Interacción */}
            <div className="card" style={{
              padding: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10
            }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
                <input
                  type="text"
                  placeholder="Buscar sucursal..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 10px 7px 30px",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 6, fontSize: 12.5, color: "var(--text-primary)",
                    outline: "none", transition: "all 0.15s ease"
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer",
                      fontSize: 11, padding: 2
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Ciudad:</span>
                  <select
                    value={selectedCiudad}
                    onChange={(e) => setSelectedCiudad(e.target.value)}
                    style={{
                      padding: "6px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="all">Todas</option>
                    {ciudades.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: "6px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="puntualidad-desc">Mayor Puntualidad</option>
                    <option value="puntualidad-asc">Menor Puntualidad (Críticos)</option>
                    <option value="entradas-desc">Mayor Volumen Entradas</option>
                    <option value="entradas-asc">Menor Volumen Entradas</option>
                    <option value="manuales-desc">Más Marcaciones Manuales</option>
                    <option value="empleados-desc">Más Colaboradores</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Listado de Tarjetas */}
            {filteredKpis.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px", background: "var(--bg-elevated)",
                borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-muted)"
              }}>
                No se encontraron sucursales activas que coincidan con la búsqueda.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {filteredKpis.map((k) => (
                  <SucursalCard key={k.sucursal_id} k={k} avgEntradas={totales.entradas / activos.length} />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

/* ─────────────── LEADERBOARD CARD ─────────────── */
function RankingCard({ title, subtitle, icon, items }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: Array<{ rank: number; label: string; percentage: number; hint: string; color: string }>;
}) {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</div>
        <div>
          <h3 className="heading-3" style={{ margin: 0 }}>{title}</h3>
          <p className="text-muted-sm" style={{ margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => {
          const rankColors: Record<number, { bg: string; color: string; label: string }> = {
            1: { bg: "rgba(245,158,11,0.18)", color: "#eab308", label: "🥇" },
            2: { bg: "rgba(148,163,184,0.18)", color: "#94a3b8", label: "🥈" },
            3: { bg: "rgba(180,83,9,0.18)", color: "#b45309", label: "🥉" },
          };
          const medal = rankColors[it.rank] ?? { bg: "var(--bg-elevated)", color: "var(--text-muted)", label: String(it.rank) };

          return (
            <div key={it.rank} style={{
              display: "flex", flexDirection: "column", gap: 6,
              padding: "10px 12px", borderRadius: 8,
              background: "var(--bg-elevated)", border: "1px solid var(--border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: medal.bg, color: medal.color,
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {medal.label}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.label}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{it.hint}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: it.color, fontVariantNumeric: "tabular-nums" }}>
                  {it.percentage}%
                </span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${it.percentage}%`, height: "100%", background: it.color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── RESUMEN OPERATIVO CARD ─────────────── */
function OperationsSummaryCard({ totales }: { totales: { sucursales: number; entradas: number; empleados: number; manuales: number } }) {
  const manualPct = totales.entradas > 0 ? (totales.manuales / totales.entradas) * 100 : 0;
  const biometricPct = 100 - manualPct;

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(20,184,166,0.15)", color: "var(--teal)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Award size={16} />
        </div>
        <div>
          <h3 className="heading-3" style={{ margin: 0 }}>Resumen de Auditoría</h3>
          <p className="text-muted-sm" style={{ margin: 0 }}>Distribución de marcaciones y validación</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, justifyContent: "center" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
            <span style={{ color: "var(--teal)" }}>Biométrico ({biometricPct.toFixed(0)}%)</span>
            <span style={{ color: "var(--yellow)", marginLeft: "auto" }}>Manual ({manualPct.toFixed(0)}%)</span>
          </div>
          <div style={{ height: 12, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${biometricPct}%`, height: "100%", background: "var(--teal)", transition: "width 300ms" }} title="Registros correctos vía reconocimiento facial" />
            <div style={{ width: `${manualPct}%`, height: "100%", background: "var(--yellow)", transition: "width 300ms" }} title="Marcaciones añadidas manualmente por administradores" />
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 6
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldAlert size={12} style={{ color: "var(--yellow)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
              Incidencia de Edición Manual
            </span>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
            {manualPct > 15 ? (
              <span style={{ color: "var(--yellow)" }}>
                Alerta: Existe un volumen elevado ({manualPct.toFixed(1)}%) de marcaciones manuales. Se recomienda auditar los motivos de ajuste para evitar inconsistencias en las horas laborales de las sucursales.
              </span>
            ) : (
              <span>
                El volumen de marcaciones manuales se encuentra en un rango saludable ({manualPct.toFixed(1)}%). La gran mayoría de los registros de asistencia han sido validados biométricamente con reconocimiento facial.
              </span>
            )}
          </p>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, marginTop: "auto" }}>
          * Las estadísticas comparativas se calculan de manera continua y en tiempo real, basándose en la actividad agregada de los últimos 30 días laborables.
        </div>
      </div>
    </div>
  );
}

/* ─────────────── SUGERENCIAS EJECUTIVAS ─────────────── */
function ExecutiveInsightsCard({ kpis }: { kpis: KPI[] }) {
  const insights = useMemo(() => {
    const list: Array<{ type: "success" | "warning" | "danger"; text: string }> = [];

    // 1. Encontrar sucursales con puntualidad crítica (< 65%)
    const criticas = kpis.filter((k) => k.total_entradas > 0 && k.ratio_puntualidad < 0.65);
    criticas.forEach((k) => {
      list.push({
        type: "danger",
        text: `Puntualidad crítica en ${k.sucursal_nombre} (${Math.round(k.ratio_puntualidad * 100)}%). Se recomienda revisar los horarios y tolerancia asignada.`,
      });
    });

    // 2. Encontrar sucursales con marcaciones manuales excesivas (> 18% del total)
    kpis.forEach((k) => {
      if (k.total_entradas > 0) {
        const ratioManual = k.marcaciones_manuales / k.total_entradas;
        if (ratioManual > 0.18) {
          list.push({
            type: "warning",
            text: `Alta incidencia manual en ${k.sucursal_nombre} (${Math.round(ratioManual * 100)}% de marcas). Se aconseja auditar los registros modificados por supervisores.`,
          });
        }
      }
    });

    // 3. Encontrar sucursal líder con excelente puntualidad (>85%) y pocas marcas manuales (<5%)
    const excelentes = kpis.filter(
      (k) => k.total_entradas > 15 && k.ratio_puntualidad >= 0.85 && (k.marcaciones_manuales / k.total_entradas) < 0.06
    );
    excelentes.forEach((k) => {
      list.push({
        type: "success",
        text: `Rendimiento ejemplar en ${k.sucursal_nombre} con ${Math.round(k.ratio_puntualidad * 100)}% de puntualidad y mínimo ajuste manual. ¡Felicidades al equipo!`,
      });
    });

    return list;
  }, [kpis]);

  if (insights.length === 0) {
    return (
      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={16} />
          </div>
          <h3 className="heading-3" style={{ margin: 0 }}>Recomendaciones</h3>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
            Operación estable. Todas las sucursales activas se encuentran dentro de las métricas normales y rangos saludables de puntualidad y biometría.
          </p>
        </div>
      </div>
    );
  }

  const icons = {
    success: <Trophy size={14} style={{ color: "#10b981" }} />,
    warning: <ShieldAlert size={14} style={{ color: "#f59e0b" }} />,
    danger: <ShieldAlert size={14} style={{ color: "#ef4444" }} />,
  };

  const borderColors = {
    success: "rgba(16,185,129,0.2)",
    warning: "rgba(245,158,11,0.2)",
    danger: "rgba(239,68,68,0.2)",
  };

  const bgColors = {
    success: "rgba(16,185,129,0.05)",
    warning: "rgba(245,158,11,0.05)",
    danger: "rgba(239,68,68,0.05)",
  };

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(139,92,246,0.15)", color: "#8b5cf6",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={16} />
        </div>
        <div>
          <h3 className="heading-3" style={{ margin: 0 }}>Sugerencias de Operación</h3>
          <p className="text-muted-sm" style={{ margin: 0 }}>Análisis en tiempo real de los 30 días</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 180 }}>
        {insights.slice(0, 4).map((ins, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${borderColors[ins.type]}`,
            background: bgColors[ins.type]
          }}>
            <div style={{ marginTop: 2 }}>{icons[ins.type]}</div>
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              {ins.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── BAR CHART COMPARATIVO ─────────────── */
function ExecutiveBarChart({ data }: { data: KPI[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((k) => {
    const manualPct = k.total_entradas > 0 ? (k.marcaciones_manuales / k.total_entradas) * 100 : 0;
    return {
      name: k.sucursal_nombre.length > 15 ? k.sucursal_nombre.slice(0, 15) + "..." : k.sucursal_nombre,
      fullName: k.sucursal_nombre,
      puntualidad: Math.round(k.ratio_puntualidad * 100),
      manual: Math.round(manualPct),
    };
  });

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(59,130,246,0.15)", color: "#3b82f6",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="heading-3" style={{ margin: 0 }}>Puntualidad vs Incidencia Manual</h3>
            <p className="text-muted-sm" style={{ margin: 0 }}>Desempeño y auditoría por sucursal</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, background: "#8b5cf6", borderRadius: 2 }} />
            <span>Puntualidad (%)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, background: "#fbbf24", borderRadius: 2 }} />
            <span>Incidencia Manual (%)</span>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: 260, marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div style={{
                      background: "rgba(15,15,20,0.95)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 12,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(4px)"
                    }}>
                      <p style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{item.fullName}</p>
                      <p style={{ margin: "0 0 4px 0", fontSize: 11, color: "#a78bfa", display: "flex", justifyContent: "space-between", gap: 20 }}>
                        <span>Puntualidad:</span>
                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{item.puntualidad}%</strong>
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#fbbf24", display: "flex", justifyContent: "space-between", gap: 20 }}>
                        <span>Incidencia Manual:</span>
                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{item.manual}%</strong>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: "Meta (80%)", fill: "#10b981", fontSize: 9, position: "top" }} />
            <Bar dataKey="puntualidad" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="manual" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────────── CIRCULAR PROGRESS DIAL ─────────────── */
function CircularProgress({ percentage, color }: { percentage: number; color: string }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: "relative", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="20" cy="20" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
        <circle cx="20" cy="20" r={radius} fill="transparent" stroke={color} strokeWidth="3.5" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
      </svg>
      <span style={{ position: "absolute", fontSize: 9.5, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
        {percentage}%
      </span>
    </div>
  );
}

/* ─────────────── SUCURSAL CARD ─────────────── */
function SucursalCard({ k, avgEntradas }: { k: KPI; avgEntradas: number }) {
  const puntualPct = Math.round(k.ratio_puntualidad * 100);
  const puntualColor = puntualPct >= 80 ? "var(--green)" : puntualPct >= 60 ? "var(--yellow)" : "var(--red)";
  
  const manualPct = k.total_entradas > 0 ? (k.marcaciones_manuales / k.total_entradas) * 100 : 0;
  const esCritico = puntualPct < 65 || manualPct > 18;

  // Comparativa vs promedio
  const vsAvg = avgEntradas > 0
    ? ((k.total_entradas - avgEntradas) / avgEntradas) * 100
    : 0;

  const horaProm = k.hora_promedio_entrada
    ? `${Math.floor(k.hora_promedio_entrada).toString().padStart(2, "0")}:${Math.round((k.hora_promedio_entrada % 1) * 60).toString().padStart(2, "0")}`
    : "—";

  return (
    <div
      className="card card-hover"
      style={{
        padding: 16, display: "flex", flexDirection: "column", gap: 14,
        border: esCritico ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid var(--border)",
        background: esCritico ? "linear-gradient(135deg, rgba(239, 68, 68, 0.02) 0%, var(--bg-card) 100%)" : "var(--bg-card)",
        boxShadow: esCritico ? "0 0 15px -5px rgba(239, 68, 68, 0.05)" : "none",
        transition: "all 0.2s ease",
        position: "relative"
      }}
    >
      {esCritico && (
        <span style={{
          position: "absolute", top: 8, right: 8,
          fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
          background: puntualPct < 65 ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
          color: puntualPct < 65 ? "#ef4444" : "#f59e0b",
          display: "flex", alignItems: "center", gap: 3
        }}>
          <ShieldAlert size={10} />
          {puntualPct < 65 ? "Puntualidad Crítica" : "Auditar Marcas"}
        </span>
      )}

      {/* Header con título y esfera de progreso */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingRight: esCritico ? 90 : 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {k.sucursal_nombre}
          </div>
          {k.ciudad && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{k.ciudad}</div>
          )}
        </div>
        <CircularProgress percentage={puntualPct} color={puntualColor} />
      </div>

      {/* Metrica principal */}
      <div style={{ background: "rgba(255,255,255,0.015)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          Entradas (Últimos 30 días)
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {k.total_entradas.toLocaleString("es-MX")}
          </div>
          {vsAvg !== 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: vsAvg > 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {vsAvg > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span>{Math.abs(Math.round(vsAvg))}% vs prom.</span>
            </div>
          )}
        </div>
      </div>

      {/* Mini stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
        <MiniStat icon={<Users size={11} />} label="Colaboradores" value={k.empleados_activos} />
        <MiniStat icon={<Clock size={11} />} label="Hora Promedio" value={horaProm} />
        <MiniStat icon={<Edit3 size={11} />} label="Marca Manual" value={`${k.marcaciones_manuales} (${Math.round(manualPct)}%)`} highlight={manualPct > 15} />
        <MiniStat icon={<Building2 size={11} />} label="Días Activos" value={k.dias_con_actividad} />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: number | string; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "8px 9px", borderRadius: 6,
      background: highlight ? "rgba(234,179,8,0.06)" : "var(--bg-elevated)",
      border: `1px solid ${highlight ? "rgba(234,179,8,0.2)" : "var(--border)"}`,
      transition: "background 150ms ease"
    }} className="mini-stat-card">
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: highlight ? "var(--yellow)" : "var(--text-muted)" }}>
        {icon}
        <span style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? "#fbbf24" : "var(--text-primary)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
