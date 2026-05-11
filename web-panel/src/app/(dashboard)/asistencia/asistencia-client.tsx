"use client";
import React, { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExportButton } from "@/components/ui/ExportButton";
import { Search, Filter, X, ChevronDown } from "lucide-react";

type Registro = {
  id: string;
  tipo: "entrada" | "salida";
  timestamp: string;
  confianza: number | null;
  empleado_id: string | null;
  sucursal_id: string | null;
  empleados: { nombre: string; apellido: string } | null;
  sucursales: { nombre: string } | null;
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

  // Filtros
  const [search, setSearch]         = useState("");
  const [empId, setEmpId]           = useState("");
  const [sucId, setSucId]           = useState("");
  const [tipo, setTipo]             = useState<"" | "entrada" | "salida">("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Paginacion (cursor: timestamp del ultimo registro cargado)
  const [loading, setLoading]       = useState(false);
  const [hasMore, setHasMore]       = useState(initial.length === 100);

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
            .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, empleados(nombre, apellido), sucursales(nombre)")
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

  // Filtro client-side (sobre los registros ya cargados).
  const filtered = useMemo(() => {
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

  const hasActiveFilters = search || empId || sucId || tipo || dateFrom || dateTo;

  function clearFilters() {
    setSearch(""); setEmpId(""); setSucId(""); setTipo("");
    setDateFrom(""); setDateTo("");
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
        .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, empleados(nombre, apellido), sucursales(nombre)")
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
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
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
            }))}
          />
        }
      />

      {/* Barra de filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empleado o sucursal..."
            style={{
              width: "100%", padding: "9px 12px 9px 32px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none",
            }}
          />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="btn btn-secondary btn-sm"
          style={{ position: "relative" }}
        >
          <Filter size={13} />
          <span>Filtros</span>
          <ChevronDown size={12} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          {hasActiveFilters && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--accent)",
            }} />
          )}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn btn-secondary btn-sm">
            <X size={13} />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <FilterField label="Empleado">
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} style={selectStyle}>
              <option value="">Todos</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id} style={{ background: "#0f0f10" }}>
                  {e.apellido} {e.nombre}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Sucursal">
            <select value={sucId} onChange={(e) => setSucId(e.target.value)} style={selectStyle}>
              <option value="">Todas</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id} style={{ background: "#0f0f10" }}>{s.nombre}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "" | "entrada" | "salida")}
              style={selectStyle}
            >
              <option value="">Todos</option>
              <option value="entrada" style={{ background: "#0f0f10" }}>Entrada</option>
              <option value="salida"  style={{ background: "#0f0f10" }}>Salida</option>
            </select>
          </FilterField>
          <FilterField label="Desde">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={selectStyle} />
          </FilterField>
          <FilterField label="Hasta">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={selectStyle} />
          </FilterField>
        </div>
      )}

      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "60ms", animationFillMode: "backwards" }}>
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 className="heading-3" style={{ marginBottom: 0 }}>Timeline de registros</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#4ade80", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 7, padding: "3px 8px", letterSpacing: "0.06em" }}>
              <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
              EN VIVO{liveCount > 0 ? ` · ${liveCount}` : ""}
            </span>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div>
            {groupByHour(filtered).map(({ hourKey, hourLabel, items }) => (
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
                    <TimelineRow key={r.id} r={r} />
                  ))}
                </div>
              </div>
            ))}

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
              {hasActiveFilters ? "Sin resultados con esos filtros" : "Aún no hay registros"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 320, margin: "0 auto" }}>
              {hasActiveFilters
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

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 13, color: "var(--text-primary)",
  outline: "none", colorScheme: "dark", cursor: "pointer",
};

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

function TimelineRow({ r }: { r: Registro }) {
  const isEntrada = r.tipo === "entrada";
  const color = isEntrada ? "#22c55e" : "#3b82f6";
  const colorSoft = isEntrada ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)";
  const colorBorder = isEntrada ? "rgba(34,197,94,0.28)" : "rgba(59,130,246,0.28)";
  const nombre = r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : "Sin empleado";
  const inicial = r.empleados?.nombre?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="timeline-row"
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        gap: 14,
        padding: "12px 22px",
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.015)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: color, justifySelf: "center",
        boxShadow: `0 0 8px ${colorSoft}, 0 0 0 3px ${colorSoft}`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `linear-gradient(135deg, ${colorSoft} 0%, ${colorBorder} 100%)`,
          border: `1px solid ${colorBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color, flexShrink: 0,
        }}>
          {inicial}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nombre}
          </span>
          {r.sucursales?.nombre && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {r.sucursales.nombre}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          padding: "3px 9px", borderRadius: 6,
          background: colorSoft, border: `1px solid ${colorBorder}`,
          color, textTransform: "uppercase",
        }}>
          {isEntrada ? "Entrada" : "Salida"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", minWidth: 56 }}>
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
    </div>
  );
}
