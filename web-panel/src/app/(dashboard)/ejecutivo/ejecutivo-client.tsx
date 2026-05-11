"use client";

import { useMemo } from "react";
import {
  Building2, TrendingUp, TrendingDown, Users, Clock, Edit3, Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportButton } from "@/components/ui/ExportButton";

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
  const totales = useMemo(() => ({
    sucursales: activos.length,
    entradas:   activos.reduce((s, k) => s + k.total_entradas, 0),
    empleados:  Math.max(...activos.map((k) => k.empleados_activos), 0),
    manuales:   activos.reduce((s, k) => s + k.marcaciones_manuales, 0),
  }), [activos]);

  // Ranking de puntualidad (descendente)
  const rankingPuntualidad = useMemo(
    () => [...activos]
      .filter((k) => k.total_entradas > 0)
      .sort((a, b) => b.ratio_puntualidad - a.ratio_puntualidad),
    [activos]
  );

  return (
    <div className="page animate-fade-up">
      <Breadcrumbs crumbs={[{ label: "Dashboard ejecutivo" }]} />
      <PageHeader
        title="Dashboard ejecutivo"
        subtitle="Comparativa entre sucursales · últimos 30 días"
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Ranking de puntualidad */}
          {rankingPuntualidad.length > 0 && (
            <RankingCard
              title="Ranking de puntualidad"
              subtitle="% de entradas antes de las 9:00 (últimos 30 días)"
              icon={<Trophy size={16} />}
              items={rankingPuntualidad.slice(0, 5).map((k, i) => ({
                rank: i + 1,
                label: k.sucursal_nombre,
                value: `${Math.round(k.ratio_puntualidad * 100)}%`,
                hint: `${k.total_entradas} entradas · ${k.empleados_activos} empleados`,
                color: k.ratio_puntualidad >= 0.8 ? "#10b981"
                     : k.ratio_puntualidad >= 0.6 ? "#f59e0b"
                     : "#ef4444",
              }))}
            />
          )}

          {/* Grid de cards por sucursal */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {activos.map((k) => (
              <SucursalCard key={k.sucursal_id} k={k} avgEntradas={totales.entradas / activos.length} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankingCard({ title, subtitle, icon, items }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: Array<{ rank: number; label: string; value: string; hint: string; color: string }>;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(245,158,11,0.15)", color: "#f59e0b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-faint)" }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <div key={it.rank} style={{
            display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "center",
            padding: "8px 10px", borderRadius: 8,
            background: "var(--bg-elevated)", gap: 12,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: it.rank === 1 ? "rgba(245,158,11,0.2)" : "var(--bg-card)",
              color: it.rank === 1 ? "#f59e0b" : "var(--text-faint)",
              fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{it.rank}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{it.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{it.hint}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: it.color, fontVariantNumeric: "tabular-nums" }}>
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SucursalCard({ k, avgEntradas }: { k: KPI; avgEntradas: number }) {
  const puntualPct = Math.round(k.ratio_puntualidad * 100);
  const puntualColor = puntualPct >= 80 ? "#10b981" : puntualPct >= 60 ? "#f59e0b" : "#ef4444";
  // Comparativa vs promedio
  const vsAvg = avgEntradas > 0
    ? ((k.total_entradas - avgEntradas) / avgEntradas) * 100
    : 0;
  const horaProm = k.hora_promedio_entrada
    ? `${Math.floor(k.hora_promedio_entrada).toString().padStart(2, "0")}:${Math.round((k.hora_promedio_entrada % 1) * 60).toString().padStart(2, "0")}`
    : "—";

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {k.sucursal_nombre}
          </div>
          {k.ciudad && (
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{k.ciudad}</div>
          )}
        </div>
        <div style={{
          padding: "3px 8px", borderRadius: 6,
          background: `${puntualColor}1f`, color: puntualColor,
          fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}>
          {puntualPct}%
        </div>
      </div>

      {/* Metrica principal */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Entradas (30d)
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {k.total_entradas.toLocaleString("es-MX")}
        </div>
        {vsAvg !== 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: vsAvg > 0 ? "#10b981" : "#ef4444", marginTop: 2 }}>
            {vsAvg > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>{Math.abs(Math.round(vsAvg))}% vs promedio</span>
          </div>
        )}
      </div>

      {/* Mini stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
        <MiniStat icon={<Users size={11} />} label="Empleados" value={k.empleados_activos} />
        <MiniStat icon={<Clock size={11} />} label="Hora prom." value={horaProm} />
        <MiniStat icon={<Edit3 size={11} />} label="Manuales" value={k.marcaciones_manuales} highlight={k.marcaciones_manuales > 10} />
        <MiniStat icon={<Building2 size={11} />} label="Días activos" value={k.dias_con_actividad} />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, highlight }: {
  icon: React.ReactNode; label: string; value: number | string; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "7px 8px", borderRadius: 6,
      background: highlight ? "rgba(245,158,11,0.08)" : "var(--bg-elevated)",
      border: `1px solid ${highlight ? "rgba(245,158,11,0.2)" : "transparent"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: highlight ? "#f59e0b" : "var(--text-faint)" }}>
        {icon}
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? "#fbbf24" : "var(--text-primary)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}
