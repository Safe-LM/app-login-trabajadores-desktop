"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge as StatusDot } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Users, Check, X, LogOut, CalendarRange, Activity, RefreshCw, Search,
  Clock, Wifi, Building2, ChevronRight, ArrowDown, ArrowUp
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type AsistenciaHoy = {
  empresa_id: string;
  empleado_id: string;
  nombre_completo: string;
  sucursal: string | null;
  ultima_entrada: string | null;
  ultima_salida: string | null;
  estado: "presente" | "ausente" | "salio";
};

export function DashboardClient({ initial }: { initial: AsistenciaHoy[] }) {
  const router = useRouter();
  const [asistencias, setAsistencias] = useState(initial);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtros interactivos
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedSucursal, setSelectedSucursal] = useState<string>("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latencia de red a Supabase
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function measurePing() {
      const start = performance.now();
      try {
        await supabase.from("registros_asistencia").select("id", { count: "exact", head: true }).limit(1);
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (err) {
        console.error("Error midiendo ping:", err);
        setLatency(null);
      }
    }
    measurePing();
    const interval = setInterval(measurePing, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setAsistencias(initial); }, [initial]);

  // Realtime granular para actualizar registros del día
  useEffect(() => {
    const supabase = createClient();
    const pendingEmpleados = new Set<string>();

    async function flushUpdates() {
      if (pendingEmpleados.size === 0) return;
      const ids = Array.from(pendingEmpleados);
      pendingEmpleados.clear();

      const { data } = await supabase
        .from("v_asistencias_hoy")
        .select("*")
        .in("empleado_id", ids);

      if (!data) return;
      const updates = data as AsistenciaHoy[];

      setAsistencias((prev) => {
        const map = new Map(prev.map((a) => [a.empleado_id, a]));
        for (const u of updates) map.set(u.empleado_id, u);
        return Array.from(map.values());
      });
    }

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registros_asistencia" },
        (payload) => {
          const row = (payload.new || payload.old) as { empleado_id?: string };
          if (row?.empleado_id) pendingEmpleados.add(row.empleado_id);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(flushUpdates, 400);
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === "SUBSCRIBED");
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err) {
      console.error("Error al refrescar el tablero:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const presentes = asistencias.filter((a) => a.estado === "presente").length;
  const salieron  = asistencias.filter((a) => a.estado === "salio").length;
  const ausentes  = asistencias.filter((a) => a.estado === "ausente").length;
  const total     = presentes + ausentes + salieron;
  const pct       = total > 0 ? Math.round((presentes / total) * 100) : 0;

  // KPIs dinámicos extras
  const asistenciaRate = pct;
  const rateLevel = asistenciaRate >= 90 ? "Excelente" : asistenciaRate >= 70 ? "Estable" : "Baja";
  const rateColor = asistenciaRate >= 90 ? "#22c55e" : asistenciaRate >= 70 ? "#eab308" : "#ef4444";

  // Hora Pico de Entradas
  const peakHour = useMemo(() => {
    const hoursMap: Record<number, number> = {};
    asistencias.forEach((a) => {
      if (a.ultima_entrada) {
        const date = new Date(a.ultima_entrada);
        const hr = date.getHours();
        hoursMap[hr] = (hoursMap[hr] || 0) + 1;
      }
    });
    let maxHour = -1;
    let maxCount = 0;
    Object.entries(hoursMap).forEach(([h, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = parseInt(h, 10);
      }
    });
    if (maxHour === -1) return "—";
    const startStr = `${maxHour.toString().padStart(2, "0")}:00`;
    const endStr = `${(maxHour + 1).toString().padStart(2, "0")}:00`;
    return `${startStr} - ${endStr}`;
  }, [asistencias]);

  // Top Sucursales Activas (ocupación)
  const topSucursales = useMemo(() => {
    const counts: Record<string, { total: number; presentes: number }> = {};
    asistencias.forEach((a) => {
      const suc = a.sucursal || "Sin Sucursal";
      if (!counts[suc]) counts[suc] = { total: 0, presentes: 0 };
      counts[suc].total += 1;
      if (a.estado === "presente") {
        counts[suc].presentes += 1;
      }
    });
    return Object.entries(counts)
      .map(([name, val]) => ({
        name,
        total: val.total,
        presentes: val.presentes,
        pct: val.total > 0 ? Math.round((val.presentes / val.total) * 100) : 0,
      }))
      .sort((a, b) => b.presentes - a.presentes)
      .slice(0, 4);
  }, [asistencias]);

  // Lista única de sucursales en los datos cargados para el filtro
  const sucursalesList = useMemo(() => {
    const list = new Set<string>();
    asistencias.forEach((a) => {
      if (a.sucursal) list.add(a.sucursal);
    });
    return Array.from(list).sort();
  }, [asistencias]);

  // Lista filtrada y ordenada
  const filteredAsistencias = useMemo(() => {
    let result = [...asistencias];

    if (selectedStatus !== "all") {
      result = result.filter((a) => a.estado === selectedStatus);
    }

    if (selectedSucursal !== "all") {
      result = result.filter((a) => a.sucursal === selectedSucursal);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.nombre_completo.toLowerCase().includes(q) ||
          (a.sucursal && a.sucursal.toLowerCase().includes(q))
      );
    }

    const ORDEN: Record<string, number> = { presente: 0, salio: 1, ausente: 2 };
    result.sort((a, b) => {
      const d = (ORDEN[a.estado] ?? 3) - (ORDEN[b.estado] ?? 3);
      if (d !== 0) return d;
      return (b.ultima_entrada ?? "").localeCompare(a.ultima_entrada ?? "");
    });

    return result;
  }, [asistencias, selectedStatus, selectedSucursal, search]);

  // Reloj client-side para evitar mismatch de hidratación
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  const fecha = now?.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) ?? "";
  const hora  = now?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "—:—";

  return (
    <div className="page animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header unificado */}
      <PageHeader
        eyebrow={fecha}
        title="Inicio"
        subtitle="Monitoreo de asistencia y personal en tiempo real"
        icon={<Activity size={20} />}
        iconColor="#10b981"
        actions={
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)",
                cursor: "pointer", opacity: isRefreshing ? 0.6 : 1, transition: "all 0.15s ease",
                height: 36
              }}
              className="btn btn-secondary"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin-custom" : ""} />
              <span>{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
            </button>

            <div style={{
              display: "flex", flexDirection: "column", alignItems: "flex-end",
              paddingLeft: 12, borderLeft: "1px solid var(--border)"
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {hora}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <StatusDot
                  kind={realtimeOk ? "live" : "offline"}
                  label={realtimeOk ? "En vivo" : "Conectando…"}
                  strong={realtimeOk}
                />
                {latency !== null && (
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    color: latency < 150 ? "#4ade80" : latency < 350 ? "#facc15" : "#ef4444",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.02em"
                  }} title="Latencia del servidor Supabase">
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />
                    {latency}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        }
      />

      {/* Stat cards — Filtros interactivos con glow */}
      <div className="stagger-fade-up" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
      }}>
        <div
          onClick={() => setSelectedStatus("all")}
          className="dashboard-kpi-card-wrapper"
          style={{
            cursor: "pointer",
            borderRadius: 14,
            padding: 2,
            border: `2px solid ${selectedStatus === "all" ? "var(--accent)" : "transparent"}`,
            background: selectedStatus === "all" ? "rgba(59,130,246,0.04)" : "transparent",
            boxShadow: selectedStatus === "all" ? "0 0 15px rgba(59,130,246,0.15)" : "none",
            transition: "all 0.2s ease"
          }}
        >
          <StatCard
            label="Total"
            value={total}
            color="blue"
            icon={<Users size={11} strokeWidth={2.25} />}
          />
        </div>
        <div
          onClick={() => setSelectedStatus("presente")}
          className="dashboard-kpi-card-wrapper"
          style={{
            cursor: "pointer",
            borderRadius: 14,
            padding: 2,
            border: `2px solid ${selectedStatus === "presente" ? "#22c55e" : "transparent"}`,
            background: selectedStatus === "presente" ? "rgba(34,197,94,0.04)" : "transparent",
            boxShadow: selectedStatus === "presente" ? "0 0 15px rgba(34,197,94,0.15)" : "none",
            transition: "all 0.2s ease"
          }}
        >
          <StatCard
            label="Presentes"
            value={presentes}
            color="green"
            icon={<Check size={11} strokeWidth={2.75} />}
            delta={total > 0 ? { value: pct, label: "del total" } : null}
          />
        </div>
        <div
          onClick={() => setSelectedStatus("ausente")}
          className="dashboard-kpi-card-wrapper"
          style={{
            cursor: "pointer",
            borderRadius: 14,
            padding: 2,
            border: `2px solid ${selectedStatus === "ausente" ? "#ef4444" : "transparent"}`,
            background: selectedStatus === "ausente" ? "rgba(239,68,68,0.04)" : "transparent",
            boxShadow: selectedStatus === "ausente" ? "0 0 15px rgba(239,68,68,0.15)" : "none",
            transition: "all 0.2s ease"
          }}
        >
          <StatCard
            label="Ausentes"
            value={ausentes}
            color="red"
            icon={<X size={11} strokeWidth={2.5} />}
          />
        </div>
        <div
          onClick={() => setSelectedStatus("salio")}
          className="dashboard-kpi-card-wrapper"
          style={{
            cursor: "pointer",
            borderRadius: 14,
            padding: 2,
            border: `2px solid ${selectedStatus === "salio" ? "#eab308" : "transparent"}`,
            background: selectedStatus === "salio" ? "rgba(234,179,8,0.04)" : "transparent",
            boxShadow: selectedStatus === "salio" ? "0 0 15px rgba(234,179,8,0.15)" : "none",
            transition: "all 0.2s ease"
          }}
        >
          <StatCard
            label="Salió"
            value={salieron}
            color="yellow"
            icon={<LogOut size={11} strokeWidth={2.25} />}
          />
        </div>
      </div>

      {/* Cuerpo principal en dos columnas */}
      <div className="dashboard-body-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, alignItems: "start" }}>
        
        {/* Columna Principal Izquierda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Progress bar */}
          {total > 0 && (
            <div className="card" style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>
                  Asistencia del día
                </span>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {pct}%
                </span>
              </div>
              <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: "var(--radius-pill)", overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${(presentes / total) * 100}%`, background: "#22c55e", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
                <div style={{ width: `${(salieron  / total) * 100}%`, background: "var(--accent)", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
              </div>
            </div>
          )}

          {/* Gráfico Recharts de entradas por hora */}
          <HourlyEntriesChart asistencias={asistencias} />

          {/* Tabla de Actividad con Toolbar integrado */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Barra de Filtros e Interacción */}
            <div className="card" style={{
              padding: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
              background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10
            }}>
              <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
                <input
                  type="text"
                  placeholder="Buscar colaborador por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 10px 7px 30px",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 6, fontSize: 12.5, color: "var(--text-primary)",
                    outline: "none", transition: "all 0.15s ease"
                  }}
                  className="dashboard-search-input"
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

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Sucursal:</span>
                <select
                  value={selectedSucursal}
                  onChange={(e) => setSelectedSucursal(e.target.value)}
                  style={{
                    padding: "6px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none",
                    cursor: "pointer"
                  }}
                  className="dashboard-select"
                >
                  <option value="all">Todas</option>
                  {sucursalesList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabla física */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{
                padding: "14px 22px",
                borderBottom: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <h2 className="heading-3" style={{ marginBottom: 2 }}>Actividad reciente</h2>
                  <p className="text-muted-sm" style={{ fontSize: 11, margin: 0 }}>
                    Colaboradores con actividad de asistencia registrada hoy
                  </p>
                </div>
                <span className="badge badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {filteredAsistencias.length} {filteredAsistencias.length === 1 ? "registro" : "registros"}
                </span>
              </div>

              {filteredAsistencias.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "auto" }}>Empleado</th>
                      <th style={{ width: 140 }}>Sucursal</th>
                      <th style={{ width: 100 }}>Entrada</th>
                      <th style={{ width: 100 }}>Salida</th>
                      <th style={{ width: 120 }}>En oficina</th>
                      <th style={{ width: 110 }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAsistencias.map((a) => {
                      const horas = tiempoEnOficina(a.ultima_entrada, a.estado, now);
                      return (
                        <tr key={a.empleado_id} className="emp-row">
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ position: "relative", flexShrink: 0 }}>
                                <div style={{
                                  width: 30, height: 30, borderRadius: "50%",
                                  background: a.estado === "presente" ? "rgba(34,197,94,0.12)" : "rgba(37,99,235,0.10)",
                                  border: a.estado === "presente" ? "1px solid rgba(34,197,94,0.25)" : "1px solid transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 11, fontWeight: 700,
                                  color: a.estado === "presente" ? "#4ade80" : "var(--accent-hover)",
                                }}>
                                  {a.nombre_completo[0]?.toUpperCase() ?? "?"}
                                </div>
                                {a.estado === "presente" && (
                                  <span className="unread-pulse-dot" style={{
                                    position: "absolute", top: -1, right: -1,
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: "#4ade80",
                                    border: "1.5px solid var(--bg-card)",
                                  }} />
                                )}
                              </div>
                              <span style={{ fontWeight: 555, color: "var(--text-primary)" }}>{a.nombre_completo}</span>
                            </div>
                          </td>
                          <td>{a.sucursal || <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>
                            {a.ultima_entrada ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-primary)" }}>
                                <ArrowDown size={11} style={{ color: "#22c55e" }} />
                                {new Date(a.ultima_entrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-faint)" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>
                            {a.ultima_salida ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-primary)" }}>
                                <ArrowUp size={11} style={{ color: "#3b82f6" }} />
                                {new Date(a.ultima_salida).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-faint)" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontVariantNumeric: "tabular-nums", color: horas ? "#4ade80" : "var(--text-faint)" }} title={horas ? "Tiempo en oficina (sesión actual)" : undefined}>
                            {horas ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={11} style={{ opacity: 0.7 }} />
                                {horas}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td><AttendanceBadge estado={a.estado} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState filter={selectedStatus} />
              )}
            </div>
          </div>
        </div>

        {/* Columna Lateral Derecha (Sidebar Analítico) */}
        <aside className="dashboard-sidebar-column" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Tarjeta de Resumen Analítico */}
          <div className="card" style={{ padding: 18, border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 12 }}>
            <h3 className="heading-3" style={{ fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} style={{ color: "var(--accent-hover)" }} />
              Estado y Latencia de Red
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Asistencia */}
              <div style={{ background: "rgba(255,255,255,0.015)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, margin: 0 }}>Tasa de Asistencia</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: rateColor, margin: "2px 0 0 0" }}>{rateLevel}</p>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {asistenciaRate}%
                </div>
              </div>

              {/* Hora Pico */}
              <div style={{ background: "rgba(255,255,255,0.015)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, margin: 0 }}>Hora Pico Registrada</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0 0" }}>{peakHour}</p>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(59,130,246,0.08)", color: "var(--accent-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={14} />
                </div>
              </div>

              {/* Ping y red */}
              <div style={{ background: "rgba(255,255,255,0.015)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, margin: 0 }}>Ping de Servidor</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: latency && latency < 150 ? "#4ade80" : latency && latency < 350 ? "#facc15" : "#f87171", margin: "2px 0 0 0" }}>
                    {latency ? `${latency} ms` : "Evaluando…"}
                  </p>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(34,197,94,0.08)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wifi size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta de Top Sucursales */}
          <div className="card" style={{ padding: 18, border: "1px solid var(--border)", background: "var(--bg-card)", borderRadius: 12 }}>
            <h3 className="heading-3" style={{ fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Building2 size={14} style={{ color: "var(--text-muted)" }} />
              Ocupación por Sucursal
            </h3>
            
            {topSucursales.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", margin: "12px 0" }}>Sin sucursales registradas hoy.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topSucursales.map((suc) => (
                  <div key={suc.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }} title={suc.name}>
                        {suc.name}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {suc.presentes} presentes / {suc.total}
                      </span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${suc.pct}%`, height: "100%", background: "var(--accent-hover)", borderRadius: 99, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Estilos inyectados para transiciones y responsividad */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-custom {
          animation: spin 0.8s linear infinite;
        }
        @keyframes pulse-unread {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .unread-pulse-dot {
          animation: pulse-unread 2s infinite;
        }
        .dashboard-kpi-card-wrapper {
          transform: translateY(0);
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .dashboard-kpi-card-wrapper:hover {
          transform: translateY(-2px);
        }
        .dashboard-search-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important;
        }
        .dashboard-select:focus {
          border-color: var(--accent) !important;
        }
        @media (min-width: 1024px) {
          .dashboard-body-grid {
            grid-template-columns: 1fr 300px !important;
          }
        }
      `}} />
    </div>
  );
}

/* ─────────────── HOURLY PEAK CHART ─────────────── */
function HourlyEntriesChart({ asistencias }: { asistencias: AsistenciaHoy[] }) {
  const chartData = useMemo(() => {
    const hoursMap: Record<number, number> = {};
    for (let h = 6; h <= 20; h++) {
      hoursMap[h] = 0;
    }

    asistencias.forEach((a) => {
      if (a.ultima_entrada) {
        const date = new Date(a.ultima_entrada);
        const hr = date.getHours();
        if (hr >= 6 && hr <= 20) {
          hoursMap[hr] = (hoursMap[hr] || 0) + 1;
        }
      }
    });

    return Object.entries(hoursMap).map(([h, val]) => {
      const hrNum = parseInt(h, 10);
      return {
        hour: `${hrNum.toString().padStart(2, "0")}:00`,
        Entradas: val,
      };
    });
  }, [asistencias]);

  const totalEntries = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.Entradas, 0);
  }, [chartData]);

  if (totalEntries === 0) return null;

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(16,185,129,0.12)", color: "#10b981",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CalendarRange size={16} />
          </div>
          <div>
            <h3 className="heading-3" style={{ margin: 0 }}>Frecuencia de Entradas de Hoy</h3>
            <p className="text-muted-sm" style={{ margin: 0 }}>Picos de marcaciones de entrada por hora</p>
          </div>
        </div>
        <span style={{ fontSize: 11, padding: "2px 8px", background: "rgba(34,197,94,0.10)", color: "#10b981", borderRadius: 6, fontWeight: 600 }}>
          {totalEntries} entradas registradas
        </span>
      </div>

      <div style={{ width: "100%", height: 180, marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="entradasGradDashboard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      background: "rgba(15,15,20,0.95)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(4px)"
                    }}>
                      <p style={{ margin: "0 0 4px 0", fontSize: 11, color: "var(--text-muted)" }}>Hora: <strong>{data.hour}</strong></p>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                        Entradas: {data.Entradas}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={2} fill="url(#entradasGradDashboard)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Tiempo en oficina de la sesión actual (ahora − última entrada).
function tiempoEnOficina(entrada: string | null, estado: string, now: Date | null): string | null {
  if (estado !== "presente" || !entrada || !now) return null;
  const ms = now.getTime() - new Date(entrada).getTime();
  if (ms < 0) return null;
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function AttendanceBadge({ estado }: { estado: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    presente: { cls: "badge badge-success", label: "Presente" },
    salio:    { cls: "badge badge-info",    label: "Salió" },
    ausente:  { cls: "badge badge-neutral", label: "Ausente" },
  };
  const s = map[estado] ?? map.ausente;
  return <span className={s.cls}>{s.label}</span>;
}

function EmptyState({ filter }: { filter: string }) {
  const title = filter === "all" ? "Esperando primera marcación"
              : filter === "presente" ? "No hay colaboradores presentes"
              : filter === "ausente" ? "No hay ausencias hoy"
              : "Nadie ha marcado salida todavía";
  return (
    <div style={{ padding: "56px 20px", textAlign: "center" }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px", color: "var(--text-faint)",
      }}>
        <CalendarRange size={22} strokeWidth={1.5} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.01em" }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
        {filter === "all"
          ? "Cuando los empleados se identifiquen en las estaciones, los registros aparecerán aquí en tiempo real."
          : "Prueba seleccionando otro filtro o realizando una nueva búsqueda de personal."
        }
      </p>
    </div>
  );
}
