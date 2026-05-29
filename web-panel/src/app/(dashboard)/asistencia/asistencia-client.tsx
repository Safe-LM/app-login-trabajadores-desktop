"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Clock,
  AlertTriangle,
  Smile,
} from "lucide-react";
import { toast } from "sonner";

type Registro = {
  id: string;
  tipo: "entrada" | "salida";
  timestamp: string;
  confianza: number | null;
  empleado_id: string | null;
  sucursal_id: string | null;
  empleados: { nombre: string; apellido: string } | null;
  sucursales: { nombre: string } | null;
  creado_manual?: boolean;
  editado_por?: string | null;
  razon_edicion?: string | null;
  original_timestamp?: string | null;
};
type EmpOpt = { id: string; nombre: string; apellido: string };
type SucOpt = { id: string; nombre: string };

const PAGE_SIZE = 50;

export function AsistenciaClient({
  registros: initial, empleados, sucursales,
}: {
  registros: Registro[];
  empleados: EmpOpt[];
  sucursales: SucOpt[];
}) {
  const [registros, setRegistros]   = useState(initial);
  const [liveCount, setLiveCount]   = useState(0);

  // S2.1: edicion manual
  type ModalState =
    | { type: "create" }
    | { type: "edit"; row: Registro }
    | { type: "delete"; row: Registro }
    | null;
  const [modal, setModal] = useState<ModalState>(null);

  // Filtros
  const [search, setSearch]         = useState("");
  const [empId, setEmpId]           = useState("");
  const [sucId, setSucId]           = useState("");
  const [tipo, setTipo]             = useState<"" | "entrada" | "salida">("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [soloSinSalida, setSoloSinSalida] = useState(false);
  const [soloBajaConfianza, setSoloBajaConfianza] = useState(false);
  const [showActivePopover, setShowActivePopover] = useState(false);

  // Vista
  const [viewMode, setViewMode]     = useState<"timeline" | "dias">("dias");
  const [hoy, setHoy]               = useState("");

  // Paginacion (cursor: timestamp del ultimo registro cargado)
  const [loading, setLoading]       = useState(false);
  const [hasMore, setHasMore]       = useState(initial.length === PAGE_SIZE);

  // Fijar "hoy" solo en cliente para evitar hidratación mismatch con SSR
  useEffect(() => { setHoy(toMXDate(new Date().toISOString())); }, []);

  // Realtime — nuevos registros entran arriba
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("asistencia-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "registros_asistencia" },
        async (payload) => {
          const r = payload.new as { id: string };
          const { data } = await supabase
            .from("registros_asistencia")
            .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, creado_manual, editado_por, razon_edicion, original_timestamp, empleados(nombre, apellido), sucursales(nombre)")
            .eq("id", r.id)
            .single();
          if (data) {
            const hydrated = data as unknown as Registro;
            setRegistros((prev) => {
              if (prev.some((x) => x.id === hydrated.id)) return prev;
              return [hydrated, ...prev];
            });
            setLiveCount((c) => c + 1);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Filtro client-side base (sobre los registros ya cargados)
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registros.filter((r) => {
      if (empId && r.empleado_id !== empId) return false;
      if (sucId && r.sucursal_id !== sucId) return false;
      if (tipo && r.tipo !== tipo) return false;
      if (dateFrom) {
        const d = r.timestamp.slice(0, 10);
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = r.timestamp.slice(0, 10);
        if (d > dateTo) return false;
      }
      if (q) {
        const name = `${r.empleados?.nombre ?? ""} ${r.empleados?.apellido ?? ""}`.toLowerCase();
        const suc  = (r.sucursales?.nombre ?? "").toLowerCase();
        if (!name.includes(q) && !suc.includes(q)) return false;
      }
      return true;
    });
  }, [registros, search, empId, sucId, tipo, dateFrom, dateTo]);

  // Filtro final aplicando alertas
  const filtered = useMemo(() => {
    return baseFiltered.filter((r) => {
      if (soloBajaConfianza) {
        if (r.confianza === null || r.confianza >= 0.80) return false;
      }
      return true;
    });
  }, [baseFiltered, soloBajaConfianza]);

  const hasActiveFilters = search || empId || sucId || tipo || dateFrom || dateTo;
  const hasActiveFiltersOrToggles = hasActiveFilters || soloSinSalida || soloBajaConfianza;

  const diasGroups = useMemo(() => {
    try {
      const groups = groupByDia(filtered);
      if (!soloSinSalida) return groups;
      return groups
        .map(g => ({ ...g, empleados: g.empleados.filter(e => e.pares.some(p => p.entrada && !p.salida)) }))
        .filter(g => g.empleados.length > 0);
    } catch { return []; }
  }, [filtered, soloSinSalida]);

  const sinSalidaCount = useMemo(() => {
    try {
      return groupByDia(baseFiltered).reduce((acc, g) =>
        acc + g.empleados.filter(e => e.pares.some(p => p.entrada && !p.salida)).length, 0);
    } catch { return 0; }
  }, [baseFiltered]);

  const bajaConfianzaCount = useMemo(() => {
    return baseFiltered.filter(r => r.confianza !== null && r.confianza < 0.80).length;
  }, [baseFiltered]);

  const enOficinaAhora = useMemo(() => {
    if (!hoy) return [];
    try {
      const hoyGroup = groupByDia(registros).find(g => g.fecha === hoy);
      return hoyGroup?.empleados.filter(e => {
        const ultimoPar = e.pares[e.pares.length - 1];
        return ultimoPar ? (ultimoPar.entrada && !ultimoPar.salida) : false;
      }) ?? [];
    } catch { return []; }
  }, [registros, hoy]);

  // Métricas para el panel superior (Dashboard)
  const metrics = useMemo(() => {
    let totalMs = 0;
    let completos = 0;
    let pendientes = 0;
    let confSum = 0;
    let confCount = 0;

    const groups = groupByDia(baseFiltered);
    for (const g of groups) {
      for (const emp of g.empleados) {
        for (const p of emp.pares) {
          if (p.entrada && p.salida) {
            completos++;
            totalMs += new Date(p.salida.timestamp).getTime() - new Date(p.entrada.timestamp).getTime();
          } else if (p.entrada && !p.salida) {
            pendientes++;
          }
        }
      }
    }

    for (const r of baseFiltered) {
      if (r.confianza != null) {
        confSum += r.confianza;
        confCount++;
      }
    }

    const avgConf = confCount > 0 ? confSum / confCount : null;

    return {
      totalMs,
      completos,
      pendientes,
      avgConf,
    };
  }, [baseFiltered]);

  function clearFilters() {
    setSearch(""); setEmpId(""); setSucId(""); setTipo("");
    setDateFrom(""); setDateTo("");
    setSoloSinSalida(false); setSoloBajaConfianza(false);
  }

  // Cargar mas registros (paginacion cursor por timestamp)
  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const lastTs = registros[registros.length - 1]?.timestamp;
      if (!lastTs) { setHasMore(false); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("registros_asistencia")
        .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, creado_manual, editado_por, razon_edicion, original_timestamp, empleados(nombre, apellido), sucursales(nombre)")
        .lt("timestamp", lastTs)
        .order("timestamp", { ascending: false })
        .limit(PAGE_SIZE);

      // Filtros server-side (aprovecha indices)
      if (empId)    q = q.eq("empleado_id", empId);
      if (sucId)    q = q.eq("sucursal_id", sucId);
      if (tipo)     q = q.eq("tipo", tipo);
      if (dateFrom) q = q.gte("timestamp", `${dateFrom}T00:00:00`);
      if (dateTo)   q = q.lte("timestamp", `${dateTo}T23:59:59`);

      const { data } = await q;
      if (data && data.length > 0) {
        setRegistros((prev) => [...prev, ...(data as unknown as Registro[])]);
        if (data.length < PAGE_SIZE) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up page">
      <PageHeader
        title="Asistencia"
        subtitle="Historial de registros y auditoría"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>}
        iconColor="#22c55e"
        stats={[
          { label: "Visibles", value: filtered.length },
          { label: "Cargados", value: registros.length },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <ExportButton
              filenamePrefix="asistencia"
              sheetName="Asistencia"
              getRows={() => filtered.map((r) => ({
                Fecha: new Date(r.timestamp).toLocaleDateString("es-MX"),
                Hora:  new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                Tipo:  r.tipo,
                Empleado: r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : "",
                Sucursal: r.sucursales?.nombre ?? "",
                Confianza: r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "",
                Manual: r.creado_manual ? "Sí" : "",
                Editado: r.editado_por ? "Sí" : "",
              }))}
            />
            <button
              onClick={() => setModal({ type: "create" })}
              className="btn btn-primary btn-sm"
            >
              <Plus size={13} />
              <span>Nueva marcación</span>
            </button>
          </div>
        }
      />

      {/* Modales S2.1 */}
      {modal?.type === "create" && (
        <CreateMarcacionModal
          empleados={empleados}
          sucursales={sucursales}
          onClose={() => setModal(null)}
          onCreated={(row) => {
            setRegistros((prev) => [row, ...prev]);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "edit" && (
        <EditMarcacionModal
          row={modal.row}
          onClose={() => setModal(null)}
          onUpdated={(updated) => {
            setRegistros((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
            setModal(null);
          }}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteMarcacionModal
          row={modal.row}
          onClose={() => setModal(null)}
          onDeleted={(id) => {
            setRegistros((prev) => prev.filter((r) => r.id !== id));
            setModal(null);
          }}
        />
      )}

      {/* Dashboard de Métricas Superior */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {/* Card 1: En oficina ahora */}
        <div
          className="stat-card"
          onMouseEnter={() => setShowActivePopover(true)}
          onMouseLeave={() => setShowActivePopover(false)}
          style={{ position: "relative", cursor: enOficinaAhora.length > 0 ? "pointer" : "default" }}
        >
          <div className="stat-card__label">
            <span className="stat-card__icon" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)", color: "#22c55e" }}>
              <span className="animate-pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            </span>
            <span>En Oficina Ahora</span>
          </div>
          <div className="stat-card__value" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {enOficinaAhora.length}
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>colaboradores</span>
          </div>
          <div className="stat-card__delta" style={{ marginTop: 4 }}>
            {enOficinaAhora.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {enOficinaAhora.slice(0, 4).map((emp, i) => {
                    let hash = 0;
                    for (let k = 0; k < emp.nombre.length; k++) {
                      hash = emp.nombre.charCodeAt(k) + ((hash << 5) - hash);
                    }
                    const h = Math.abs(hash % 360);
                    const bg = `hsl(${h}, 50%, 15%)`;
                    const color = `hsl(${h}, 70%, 75%)`;
                    return (
                      <div
                        key={i}
                        title={emp.nombre}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: bg,
                          border: "1.5px solid var(--bg-card)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          fontWeight: 700,
                          color: color,
                          marginLeft: i > 0 ? -6 : 0,
                          zIndex: 10 - i,
                        }}
                      >
                        {emp.inicial}
                      </div>
                    );
                  })}
                  {enOficinaAhora.length > 4 && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--bg-elevated)",
                        border: "1.5px solid var(--bg-card)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        marginLeft: -6,
                        zIndex: 5,
                      }}
                    >
                      +{enOficinaAhora.length - 4}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {enOficinaAhora.length === 1 ? "Turno activo" : "Turnos activos"}
                </span>
              </div>
            ) : (
              "Ningún turno activo"
            )}
          </div>

          {/* Popover flotante con el detalle de las personas en la oficina */}
          {showActivePopover && enOficinaAhora.length > 0 && (
            <div
              className="card animate-fade-in"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 8,
                width: 260,
                zIndex: 50,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                padding: 12,
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                En Oficina Ahora ({enOficinaAhora.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
                {enOficinaAhora.map((emp, i) => {
                  const ultimoPar = emp.pares[emp.pares.length - 1];
                  const horaEntrada = ultimoPar?.entrada ? toMXTime(ultimoPar.entrada.timestamp) : "";
                  const sucursal = ultimoPar?.entrada?.sucursales?.nombre || "Estación";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {emp.nombre}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          Entró {horaEntrada} en {sucursal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Horas del Periodo */}
        <div className="stat-card">
          <div className="stat-card__label">
            <span className="stat-card__icon" style={{ background: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.2)", color: "#2563eb" }}>
              <Clock size={12} />
            </span>
            <span>Horas del Periodo</span>
          </div>
          <div className="stat-card__value">
            {formatHoras(metrics.totalMs)}
          </div>
          <div className="stat-card__delta">
            En {metrics.completos} jornada{metrics.completos !== 1 ? "s" : ""} completa{metrics.completos !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Card 3: Sin Salida */}
        <div className="stat-card" onClick={() => { if (metrics.pendientes > 0) setSoloSinSalida(v => !v); }} style={{ cursor: metrics.pendientes > 0 ? "pointer" : "default" }}>
          <div className="stat-card__label">
            <span className="stat-card__icon" style={{ background: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.2)", color: "#eab308" }}>
              <AlertTriangle size={12} />
            </span>
            <span>Sin Salida (Alertas)</span>
          </div>
          <div className="stat-card__value" style={{ color: metrics.pendientes > 0 ? "#facc15" : "var(--text-primary)" }}>
            {metrics.pendientes}
          </div>
          <div className="stat-card__delta" style={{ color: metrics.pendientes > 0 ? "#facc15" : "var(--text-muted)" }}>
            {metrics.pendientes > 0 ? "⚠️ Marcaciones incompletas" : "Todo al día"}
          </div>
        </div>

        {/* Card 4: Coincidencia Facial */}
        <div className="stat-card">
          <div className="stat-card__label">
            <span className="stat-card__icon" style={{ background: "rgba(20,184,166,0.1)", borderColor: "rgba(20,184,166,0.2)", color: "#14b8a6" }}>
              <Smile size={12} />
            </span>
            <span>Coincidencia Facial</span>
          </div>
          <div className="stat-card__value" style={{ color: metrics.avgConf && metrics.avgConf < 0.8 ? "#f87171" : "var(--text-primary)" }}>
            {metrics.avgConf ? `${Math.round(metrics.avgConf * 100)}%` : "—"}
          </div>
          <div className="stat-card__delta">
            Promedio de validación de rostro
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px", minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por colaborador o sucursal..."
              className="input"
              style={{ paddingLeft: 32 }}
            />
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className="btn btn-secondary btn-sm"
            style={{ position: "relative" }}
          >
            <Filter size={13} />
            <span>Filtros avanzados</span>
            <ChevronDown size={12} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            {hasActiveFilters && (
              <span style={{
                position: "absolute", top: -2, right: -2,
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--accent)",
              }} />
            )}
          </button>

          {viewMode === "dias" && (
            <button
              onClick={() => setSoloSinSalida(v => !v)}
              className="btn btn-secondary btn-sm"
              style={{
                background: soloSinSalida ? "rgba(251,191,36,0.12)" : "var(--bg-elevated)",
                borderColor: soloSinSalida ? "#fbbf24" : "var(--border)",
                color: soloSinSalida ? "#fbbf24" : "var(--text-secondary)",
              }}
            >
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#fbbf24", marginRight: 6 }} />
              Sin salida ({sinSalidaCount})
            </button>
          )}

          <button
            onClick={() => setSoloBajaConfianza(v => !v)}
            className="btn btn-secondary btn-sm"
            style={{
              background: soloBajaConfianza ? "rgba(239,68,68,0.12)" : "var(--bg-elevated)",
              borderColor: soloBajaConfianza ? "#ef4444" : "var(--border)",
              color: soloBajaConfianza ? "#f87171" : "var(--text-secondary)",
            }}
          >
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#ef4444", marginRight: 6 }} />
            Baja confianza ({bajaConfianzaCount})
          </button>

          {hasActiveFiltersOrToggles && (
            <button onClick={clearFilters} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>
              <X size={13} />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Panel de filtros avanzado expandible */}
        {showFilters && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}>
            <FilterField label="Empleado">
              <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="input" style={{ height: 36, padding: "0 10px" }}>
                <option value="">Todos</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id} style={{ background: "var(--bg-elevated)" }}>
                    {e.apellido} {e.nombre}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Sucursal">
              <select value={sucId} onChange={(e) => setSucId(e.target.value)} className="input" style={{ height: 36, padding: "0 10px" }}>
                <option value="">Todas</option>
                {sucursales.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: "var(--bg-elevated)" }}>{s.nombre}</option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Tipo">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "" | "entrada" | "salida")}
                className="input"
                style={{ height: 36, padding: "0 10px" }}
              >
                <option value="">Todos</option>
                <option value="entrada" style={{ background: "var(--bg-elevated)" }}>Entrada</option>
                <option value="salida"  style={{ background: "var(--bg-elevated)" }}>Salida</option>
              </select>
            </FilterField>
            <FilterField label="Desde">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" style={{ height: 36 }} />
            </FilterField>
            <FilterField label="Hasta">
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" style={{ height: 36 }} />
            </FilterField>
          </div>
        )}
      </div>

      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "60ms", animationFillMode: "backwards" }}>
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="heading-3" style={{ marginBottom: 0 }}>Registros de asistencia</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#4ade80", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 7, padding: "3px 8px", letterSpacing: "0.06em" }}>
              <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
              EN VIVO{liveCount > 0 ? ` · ${liveCount}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 2, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
            {(["dias", "timeline"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "none", transition: "all 120ms",
                  background: viewMode === mode ? "var(--bg-surface)" : "transparent",
                  color: viewMode === mode ? "var(--text-primary)" : "var(--text-faint)",
                  boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                }}
              >
                {mode === "dias" ? "Por día" : "Timeline"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div>
            {viewMode === "dias" ? (
              <DiaView
                groups={diasGroups}
                hoy={hoy}
                onEdit={(r) => setModal({ type: "edit", row: r })}
                onDelete={(r) => setModal({ type: "delete", row: r })}
              />
            ) : (
              groupByHour(filtered).map(({ hourKey, hourLabel, items }) => (
                <div key={hourKey}>
                  <div style={{
                    position: "sticky", top: 0, zIndex: 2,
                    padding: "8px 22px",
                    background: "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-card) 80%, transparent 100%)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.1em", fontVariantNumeric: "tabular-nums" }}>
                      {hourLabel}
                    </span>
                    <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--border) 0%, transparent 100%)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                      {items.length}
                    </span>
                  </div>
                  <div className="stagger-fade-up">
                    {items.map((r) => (
                      <TimelineRow
                        key={r.id}
                        r={r}
                        onEdit={() => setModal({ type: "edit", row: r })}
                        onDelete={() => setModal({ type: "delete", row: r })}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Boton cargar mas (paginacion) */}
            {hasMore && (
              <div style={{ padding: "16px 22px", display: "flex", justifyContent: "center", borderTop: "1px solid var(--border)" }}>
                <button onClick={loadMore} disabled={loading} className="btn btn-secondary btn-sm">
                  {loading ? "Cargando..." : `Cargar más (${PAGE_SIZE})`}
                </button>
              </div>
            )}
            {!hasMore && registros.length > 100 && (
              <div style={{ padding: "16px 22px", textAlign: "center", fontSize: 11, color: "var(--text-faint)", borderTop: "1px solid var(--border)" }}>
                — Fin del historial —
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "80px 20px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)",
              border: "1px solid rgba(34,197,94,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", color: "#4ade80",
              boxShadow: "0 8px 22px -10px rgba(34,197,94,0.4)",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 5 }}>
              {hasActiveFiltersOrToggles ? "Sin resultados con esos filtros" : "Aún no hay registros"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 320, margin: "0 auto" }}>
              {hasActiveFiltersOrToggles
                ? "Prueba con otros filtros o limpiarlos para ver toda la actividad."
                : "Cuando los empleados se identifiquen en una estación, sus registros aparecerán aquí en tiempo real."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─── Agrupar por hora (HH:00) ─── */
function groupByHour(rows: Registro[]): Array<{ hourKey: string; hourLabel: string; items: Registro[] }> {
  const map = new Map<string, Registro[]>();
  for (const r of rows) {
    const d = new Date(r.timestamp);
    const dateStr = d.toISOString().split("T")[0];
    const hh = d.getHours().toString().padStart(2, "0");
    const key = `${dateStr}-${hh}`;
    const arr = map.get(key) ?? [];
    arr.push(r);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([hourKey, items]) => {
      const sample = new Date(items[0].timestamp);
      const hourLabel = sample.toLocaleString("es-MX", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      }).replace(/(\d{2}):\d{2}/, "$1:00");
      return { hourKey, hourLabel, items };
    });
}

function TimelineRow({ r, onEdit, onDelete }: {
  r: Registro;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isEntrada = r.tipo === "entrada";
  const color = isEntrada ? "var(--green)" : "var(--accent)";
  const badgeClass = isEntrada ? "badge-success" : "badge-info";
  const nombre = r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : "Sin empleado";
  const inicial = r.empleados?.nombre?.[0]?.toUpperCase() ?? "?";
  const wasEdited = !!r.editado_por || !!r.original_timestamp;

  return (
    <div
      className="timeline-row asistencia-row"
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto auto",
        gap: 14,
        padding: "12px 22px",
        alignItems: "center",
        borderBottom: "1px solid var(--border)",
        transition: "background 150ms",
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, justifySelf: "center",
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: isEntrada ? "var(--green-soft)" : "var(--accent-soft)",
          border: `1px solid ${isEntrada ? "rgba(34,197,94,0.2)" : "rgba(37,99,235,0.2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color, flexShrink: 0,
        }}>
          {inicial}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nombre}
            </span>
            {r.creado_manual && (
              <span className="badge" style={{ fontSize: 8, padding: "1px 5px", background: "rgba(139,92,246,0.12)", color: "#c084fc", borderColor: "rgba(139,92,246,0.2)" }}>
                Manual
              </span>
            )}
            {wasEdited && !r.creado_manual && (
              <span className="badge" style={{ fontSize: 8, padding: "1px 5px", background: "rgba(245,158,11,0.12)", color: "#fbd38d", borderColor: "rgba(245,158,11,0.2)" }}>
                Editada
              </span>
            )}
          </div>
          {r.sucursales?.nombre && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {r.sucursales.nombre}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className={`badge ${badgeClass}`} style={{ fontSize: 10, textTransform: "uppercase" }}>
          {isEntrada ? "Entrada" : "Salida"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minWidth: 56 }}>
          {new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        {r.confianza != null && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: r.confianza >= 0.9 ? "#4ade80" : r.confianza >= 0.75 ? "#facc15" : "#f87171",
            fontVariantNumeric: "tabular-nums",
            minWidth: 36, textAlign: "right",
          }}>
            {Math.round(r.confianza * 100)}%
          </span>
        )}
      </div>
      <div className="row-actions" style={{ display: "flex", gap: 4 }}>
        <button onClick={onEdit} title="Editar marcación" className="btn btn-ghost btn-sm btn-icon" style={{ width: 26, height: 26 }}>
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} title="Eliminar marcación" className="btn btn-ghost btn-sm btn-icon" style={{ width: 26, height: 26, color: "#f87171" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

/* ─── Vista "Por día" — pares entrada/salida agrupados por empleado ─── */
const MX_TZ = "America/Mexico_City";

type ParJornada = { entrada: Registro | null; salida: Registro | null };
type EmpleadoDia = { empleado_id: string | null; nombre: string; inicial: string; pares: ParJornada[] };
type DiaGroup = { fecha: string; label: string; empleados: EmpleadoDia[]; total: number };

function toMXDate(ts: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date(ts));
}

function toMXTime(ts: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(ts));
}

function formatHoras(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Debounce de scans duplicados: dos marcas del MISMO tipo en menos de 5 min
const DEBOUNCE_MS = 5 * 60 * 1000;

function dedupeScans(sortedAsc: Registro[]): Registro[] {
  const out: Registro[] = [];
  for (const r of sortedAsc) {
    const last = out[out.length - 1];
    if (last && last.tipo === r.tipo) {
      const diff = new Date(r.timestamp).getTime() - new Date(last.timestamp).getTime();
      if (diff < DEBOUNCE_MS) continue;
    }
    out.push(r);
  }
  return out;
}

function groupByDia(rows: Registro[]): DiaGroup[] {
  const byFecha = new Map<string, Registro[]>();
  for (const r of rows) {
    if (!r.timestamp) continue;
    const fecha = toMXDate(r.timestamp);
    const arr = byFecha.get(fecha) ?? [];
    arr.push(r);
    byFecha.set(fecha, arr);
  }

  return Array.from(byFecha.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((fecha) => {
      const registrosDia = byFecha.get(fecha)!;
      const byEmp = new Map<string, Registro[]>();
      for (const r of registrosDia) {
        const key = r.empleado_id ?? "__unknown__";
        const arr = byEmp.get(key) ?? [];
        arr.push(r);
        byEmp.set(key, arr);
      }

      const empleados: EmpleadoDia[] = Array.from(byEmp.entries()).map(([empId, regs]) => {
        const sorted = dedupeScans([...regs].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
        const nombre = regs[0]?.empleados ? `${regs[0].empleados.nombre} ${regs[0].empleados.apellido}` : "Sin empleado";
        const inicial = regs[0]?.empleados?.nombre?.[0]?.toUpperCase() ?? "?";
        const pares: ParJornada[] = [];
        let currentEntrada: Registro | null = null;
        for (const r of sorted) {
          if (r.tipo === "entrada") {
            if (currentEntrada) pares.push({ entrada: currentEntrada, salida: null });
            currentEntrada = r;
          } else {
            pares.push({ entrada: currentEntrada, salida: r });
            currentEntrada = null;
          }
        }
        if (currentEntrada) pares.push({ entrada: currentEntrada, salida: null });
        return { empleado_id: empId === "__unknown__" ? null : empId, nombre, inicial, pares };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));

      const label = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
      return { fecha, label, empleados, total: registrosDia.length };
    });
}

function DropdownAcciones({
  entrada,
  salida,
  onEdit,
  onDelete,
}: {
  entrada: Registro | null;
  salida: Registro | null;
  onEdit: (r: Registro) => void;
  onDelete: (r: Registro) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={toggleDropdown}
        className="btn btn-ghost btn-sm btn-icon"
        style={{ width: 28, height: 28, borderRadius: 6 }}
        title="Acciones"
      >
        <MoreHorizontal size={14} />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: 4,
            width: 160,
            zIndex: 100,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            textAlign: "left",
          }}
        >
          {entrada && (
            <>
              <button
                onClick={() => {
                  onEdit(entrada);
                  setIsOpen(false);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: "flex-start", padding: "6px 8px", width: "100%" }}
              >
                <Pencil size={11} style={{ marginRight: 6 }} />
                <span style={{ fontSize: 12 }}>Editar entrada</span>
              </button>
              <button
                onClick={() => {
                  onDelete(entrada);
                  setIsOpen(false);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: "flex-start", padding: "6px 8px", width: "100%", color: "#f87171" }}
              >
                <Trash2 size={11} style={{ marginRight: 6 }} />
                <span style={{ fontSize: 12 }}>Eliminar entrada</span>
              </button>
            </>
          )}

          {entrada && salida && (
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          )}

          {salida && (
            <>
              <button
                onClick={() => {
                  onEdit(salida);
                  setIsOpen(false);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: "flex-start", padding: "6px 8px", width: "100%" }}
              >
                <Pencil size={11} style={{ marginRight: 6 }} />
                <span style={{ fontSize: 12 }}>Editar salida</span>
              </button>
              <button
                onClick={() => {
                  onDelete(salida);
                  setIsOpen(false);
                }}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: "flex-start", padding: "6px 8px", width: "100%", color: "#f87171" }}
              >
                <Trash2 size={11} style={{ marginRight: 6 }} />
                <span style={{ fontSize: 12 }}>Eliminar salida</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CellRegistro({ r, tipo }: { r: Registro | null; tipo: "entrada" | "salida" }) {
  if (!r) {
    if (tipo === "salida") {
      return (
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: "#fbbf24",
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.18)",
          padding: "2px 6px",
          borderRadius: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24" }} />
          Pendiente
        </span>
      );
    }
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const isEntrada = tipo === "entrada";
  const dotColor = isEntrada ? "#22c55e" : "#3b82f6";
  const wasEdited = !!r.editado_por || !!r.original_timestamp;

  let confColor = "var(--text-muted)";
  if (r.confianza != null) {
    if (r.confianza >= 0.90) confColor = "#4ade80";
    else if (r.confianza >= 0.75) confColor = "#facc15";
    else confColor = "#f87171";
  }

  const formattedTime = toMXTime(r.timestamp);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {formattedTime}
      </span>

      {r.confianza != null && (
        <span
          title={`Confianza del reconocimiento facial: ${Math.round(r.confianza * 100)}%`}
          style={{
            fontSize: 10,
            color: confColor,
            fontWeight: 600,
            background: "rgba(255,255,255,0.02)",
            padding: "1px 4px",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.04)"
          }}
        >
          {Math.round(r.confianza * 100)}%
        </span>
      )}

      {r.creado_manual && (
        <span
          title={`Marcación creada manualmente por administrador${r.razon_edicion ? `: ${r.razon_edicion}` : ""}`}
          style={{
            fontSize: 8,
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 4,
            background: "rgba(139,92,246,0.12)",
            color: "#c084fc",
            border: "1px solid rgba(139,92,246,0.2)",
            cursor: "help",
            textTransform: "uppercase"
          }}
        >
          Manual
        </span>
      )}

      {wasEdited && !r.creado_manual && (
        <span
          title={`Marcación editada por administrador${r.razon_edicion ? `: ${r.razon_edicion}` : ""}`}
          style={{
            fontSize: 8,
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 4,
            background: "rgba(245,158,11,0.12)",
            color: "#fbd38d",
            border: "1px solid rgba(245,158,11,0.2)",
            cursor: "help",
            textTransform: "uppercase"
          }}
        >
          Editado
        </span>
      )}
    </div>
  );
}

function EmpleadoDiaRow({
  emp,
  isHoy,
  onEdit,
  onDelete,
}: {
  emp: EmpleadoDia;
  isHoy: boolean;
  onEdit: (r: Registro) => void;
  onDelete: (r: Registro) => void;
}) {
  const totalMs = emp.pares.reduce((acc, p) => {
    if (!p.entrada || !p.salida) return acc;
    return acc + (new Date(p.salida.timestamp).getTime() - new Date(p.entrada.timestamp).getTime());
  }, 0);

  const hasPendiente = emp.pares.some((p) => p.entrada && !p.salida);
  const ultimoPar = emp.pares[emp.pares.length - 1];
  const estaEnOficina = ultimoPar ? (ultimoPar.entrada && !ultimoPar.salida) : false;
  const turnoActivo = isHoy && estaEnOficina;

  const avatarBg = useMemo(() => {
    let hash = 0;
    const name = emp.nombre;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 50%, 15%)`;
  }, [emp.nombre]);

  const avatarColor = useMemo(() => {
    let hash = 0;
    const name = emp.nombre;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 75%)`;
  }, [emp.nombre]);

  return (
    <>
      {emp.pares.map((par, index) => {
        const isFirst = index === 0;
        const ms = par.entrada && par.salida
          ? new Date(par.salida.timestamp).getTime() - new Date(par.entrada.timestamp).getTime()
          : null;

        const sucursalNombre = par.entrada?.sucursales?.nombre || par.salida?.sucursales?.nombre || "—";

        return (
          <tr
            key={index}
            className="asistencia-row"
            style={{
              background: turnoActivo ? "rgba(34,197,94,0.015)" : "transparent",
            }}
          >
            {/* Colaborador */}
            <td>
              {isFirst ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: avatarBg,
                      border: `1px solid ${avatarColor}33`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: avatarColor,
                    }}>
                      {emp.inicial}
                    </div>
                    {turnoActivo && (
                      <span className="animate-pulse-dot" style={{
                        position: "absolute", top: -2, right: -2,
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#22c55e", boxShadow: "0 0 6px #22c55e",
                        border: "1.5px solid var(--bg-card)",
                      }} />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {emp.nombre}
                    </span>
                    {turnoActivo && (
                      <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 500 }}>
                        En oficina ahora
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ paddingLeft: 38, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Turno secundario
                </div>
              )}
            </td>

            {/* Sucursal */}
            <td>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                {sucursalNombre}
              </span>
            </td>

            {/* Entrada */}
            <td>
              <CellRegistro r={par.entrada} tipo="entrada" />
            </td>

            {/* Salida */}
            <td>
              <CellRegistro r={par.salida} tipo="salida" />
            </td>

            {/* Duración */}
            <td>
              {isFirst && totalMs > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className={`badge ${hasPendiente ? "badge-warn" : "badge-success"}`} style={{ fontSize: 11, width: "fit-content" }}>
                    {formatHoras(totalMs)}
                  </span>
                  {emp.pares.length > 1 && (
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                      Suma de {emp.pares.length} turnos
                    </span>
                  )}
                </div>
              ) : ms !== null && !isFirst ? (
                <span className="badge badge-neutral" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatHoras(ms)}
                </span>
              ) : hasPendiente && isFirst ? (
                <span className="badge badge-warn" style={{ fontSize: 11 }}>
                  Incompleto
                </span>
              ) : (
                "—"
              )}
            </td>

            {/* Acciones */}
            <td style={{ textAlign: "right" }}>
              <DropdownAcciones
                entrada={par.entrada}
                salida={par.salida}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}

function DiaView({
  groups,
  hoy,
  onEdit,
  onDelete,
}: {
  groups: DiaGroup[];
  hoy: string;
  onEdit: (r: Registro) => void;
  onDelete: (r: Registro) => void;
}) {
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const toggleDay = (fecha: string) => {
    setCollapsedDays((prev) => ({
      ...prev,
      [fecha]: !prev[fecha],
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>
      {groups.map((grupo) => {
        const isCollapsed = !!collapsedDays[grupo.fecha];
        return (
          <div key={grupo.fecha} className="card" style={{ overflow: "hidden" }}>
            <div
              onClick={() => toggleDay(grupo.fecha)}
              style={{
                padding: "12px 18px",
                background: "var(--bg-elevated)",
                borderBottom: isCollapsed ? "none" : "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
                transition: "background 150ms",
              }}
              className="hover:bg-hover"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronDown
                  size={14}
                  style={{
                    transform: isCollapsed ? "rotate(-90deg)" : "none",
                    transition: "transform 200ms",
                    color: "var(--text-muted)",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {grupo.label}
                </span>
                {grupo.fecha === hoy && (
                  <span className="badge badge-success" style={{ fontSize: 9, padding: "1px 6px" }}>
                    HOY
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                {grupo.empleados.length} colaborador{grupo.empleados.length !== 1 ? "es" : ""} · {grupo.total} marcación{grupo.total !== 1 ? "es" : ""}
              </span>
            </div>

            {!isCollapsed && (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "240px" }}>Colaborador</th>
                      <th style={{ width: "160px" }}>Sucursal</th>
                      <th style={{ width: "180px" }}>Entrada</th>
                      <th style={{ width: "180px" }}>Salida</th>
                      <th style={{ width: "120px" }}>Jornada</th>
                      <th style={{ width: "80px", textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.empleados.map((emp, i) => (
                      <EmpleadoDiaRow
                        key={i}
                        emp={emp}
                        isHoy={grupo.fecha === hoy}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  S2.1: Modales de edicion manual de marcaciones
// ════════════════════════════════════════════════════════════════════

function ModalShell({ title, subtitle, onClose, children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes modal-backdrop { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modal-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes modal-field {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .modal-field-anim { animation: modal-field 280ms cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        animation: "modal-backdrop 200ms ease both",
      } as React.CSSProperties}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: "min(480px, 100%)",
          background: "rgba(18,18,20,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          boxShadow: "0 40px 100px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.06)",
          overflow: "hidden",
          animation: "modal-slide-up 320ms cubic-bezier(.22,1,.36,1) both",
        }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {title && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>}
            {subtitle && <p style={{ margin: title ? "2px 0 0" : 0, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", color: "rgba(255,255,255,0.45)", padding: 0, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
    </>,
    document.body
  );
}

function ModalField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

const modalInput: React.CSSProperties = {
  width: "100%", padding: "10px 12px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, color: "var(--text-primary)",
  outline: "none", colorScheme: "dark", fontFamily: "inherit", boxSizing: "border-box",
};

function CreateMarcacionModal({
  empleados, sucursales, onClose, onCreated,
}: {
  empleados: EmpOpt[];
  sucursales: SucOpt[];
  onClose: () => void;
  onCreated: (row: Registro) => void;
}) {
  const [empleadoId, setEmpleadoId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [tipo, setTipo]             = useState<"entrada" | "salida">("entrada");
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime]             = useState(new Date().toTimeString().slice(0, 5));
  const [razon, setRazon]           = useState("");
  const [saving, setSaving]         = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!empleadoId) { toast.error("Selecciona un empleado"); return; }
    if (razon.trim().length < 4) { toast.error("Razón obligatoria (mín. 4 caracteres)"); return; }

    setSaving(true);
    try {
      const ts = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/asistencia/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empleado_id: empleadoId,
          sucursal_id: sucursalId || null,
          tipo, timestamp: ts, razon,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      const emp = empleados.find((e) => e.id === empleadoId);
      const suc = sucursales.find((s) => s.id === sucursalId);
      onCreated({
        id: data.id, tipo, timestamp: ts, confianza: null,
        empleado_id: empleadoId, sucursal_id: sucursalId || null,
        empleados: emp ? { nombre: emp.nombre, apellido: emp.apellido } : null,
        sucursales: suc ? { nombre: suc.nombre } : null,
        creado_manual: true,
      });
      toast.success("Marcación creada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const accent = tipo === "entrada" ? "#22c55e" : "#3b82f6";
  const empSel = empleados.find(e => e.id === empleadoId);

  return (
    <ModalShell title="Nueva marcación" subtitle="Corrección manual de asistencia" onClose={onClose}>
      <form onSubmit={submit}>

        {/* Tipo toggle */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
            {(["entrada", "salida"] as const).map((t) => {
              const active = tipo === t;
              const c = t === "entrada" ? "#22c55e" : "#3b82f6";
              return (
                <button key={t} type="button" onClick={() => setTipo(t)} style={{
                  padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                  background: active ? c : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.35)",
                  fontWeight: 700, fontSize: 13, transition: "all 150ms",
                  boxShadow: active ? `0 2px 12px ${c}55` : "none",
                  textTransform: "capitalize",
                }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Empleado */}
          <div className="modal-field-anim" style={{ position: "relative", animationDelay: "50ms" }}>
            {empSel && (
              <div style={{
                position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                width: 22, height: 22, borderRadius: 6,
                background: `${accent}22`, border: `1px solid ${accent}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: accent, zIndex: 1, pointerEvents: "none",
              }}>
                {empSel.nombre[0]?.toUpperCase()}
              </div>
            )}
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} required
              style={{ ...modalInput, paddingLeft: empSel ? 40 : 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <option value="">Selecciona un empleado</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id} style={{ background: "#111" }}>{e.apellido} {e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Fecha + Hora */}
          <div className="modal-field-anim" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, animationDelay: "100ms" }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              style={{ ...modalInput, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required
              style={{ ...modalInput, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Sucursal solo si hay */}
          {sucursales.length > 0 && (
            <select className="modal-field-anim" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}
              style={{ ...modalInput, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", animationDelay: "140ms" }}>
              <option value="">Sin sucursal (opcional)</option>
              {sucursales.map((s) => <option key={s.id} value={s.id} style={{ background: "#111" }}>{s.nombre}</option>)}
            </select>
          )}

          {/* Razón */}
          <textarea className="modal-field-anim" value={razon} onChange={(e) => setRazon(e.target.value)}
            rows={2} required minLength={4}
            placeholder="Razón del ajuste (obligatoria)…"
            style={{ ...modalInput, resize: "none", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 60, animationDelay: "160ms" }}
          />

          {/* Botones */}
          <div className="modal-field-anim" style={{ display: "flex", gap: 8, paddingTop: 2, animationDelay: "200ms" }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{
              flex: 2, padding: "10px", borderRadius: 10, border: "none",
              background: saving ? "rgba(255,255,255,0.08)" : accent,
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : `0 4px 16px ${accent}55`, transition: "all 150ms",
            }}>
              {saving ? "Guardando…" : `Registrar ${tipo}`}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function EditMarcacionModal({ row, onClose, onUpdated }: {
  row: Registro;
  onClose: () => void;
  onUpdated: (updated: Partial<Registro> & { id: string }) => void;
}) {
  const d = new Date(row.timestamp);
  const [tipo, setTipo] = useState<"entrada" | "salida">(row.tipo);
  const [date, setDate] = useState(d.toISOString().slice(0, 10));
  const [time, setTime] = useState(d.toTimeString().slice(0, 5));
  const [razon, setRazon] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (razon.trim().length < 4) { toast.error("Razón obligatoria"); return; }
    setSaving(true);
    try {
      const ts = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/asistencia/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, tipo, timestamp: ts, razon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar");
      onUpdated({
        id: row.id, tipo, timestamp: ts,
        editado_por: "self", razon_edicion: razon,
        original_timestamp: row.original_timestamp ?? row.timestamp,
      });
      toast.success("Marcación actualizada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const empName = row.empleados ? `${row.empleados.nombre} ${row.empleados.apellido}` : "—";
  return (
    <ModalShell title="Editar marcación" subtitle={empName} onClose={onClose}>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <ModalField label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "salida")} style={modalInput}>
              <option value="entrada" style={{ background: "#0f0f10" }}>Entrada</option>
              <option value="salida"  style={{ background: "#0f0f10" }}>Salida</option>
            </select>
          </ModalField>
          <ModalField label="Fecha">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={modalInput} required />
          </ModalField>
          <ModalField label="Hora">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={modalInput} required />
          </ModalField>
        </div>
        <ModalField label="Razón del cambio (obligatoria)" hint="Quedará registrada en el audit log.">
          <textarea
            value={razon} onChange={(e) => setRazon(e.target.value)}
            rows={2} required minLength={4}
            placeholder="Ej: corrección de horario / empleado avisa retraso justificado / etc."
            style={{ ...modalInput, resize: "vertical", minHeight: 60 }}
          />
        </ModalField>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteMarcacionModal({ row, onClose, onDeleted }: {
  row: Registro;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [razon, setRazon] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (razon.trim().length < 4) { toast.error("Razón obligatoria"); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/asistencia/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, razon }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      onDeleted(row.id);
      toast.success("Marcación eliminada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const empName = row.empleados ? `${row.empleados.nombre} ${row.empleados.apellido}` : "—";
  const when = new Date(row.timestamp).toLocaleString("es-MX");
  return (
    <ModalShell
      title="Eliminar marcación"
      subtitle={`${empName} · ${row.tipo} · ${when}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div style={{
          padding: 12, marginBottom: 14, borderRadius: 8,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 12, color: "#fca5a5", lineHeight: 1.5,
        }}>
          ⚠️ Esta acción es irreversible. La marcación quedará registrada en el audit log con la razón provista para auditoría posterior.
        </div>
        <ModalField label="Razón (obligatoria)">
          <textarea
            value={razon} onChange={(e) => setRazon(e.target.value)}
            rows={2} required minLength={4}
            placeholder="Ej: duplicado / error de reconocimiento / etc."
            style={{ ...modalInput, resize: "vertical", minHeight: 60 }}
          />
        </ModalField>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={deleting} className="btn btn-danger" style={{ flex: 2 }}>
            {deleting ? "Eliminando..." : "Eliminar marcación"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
