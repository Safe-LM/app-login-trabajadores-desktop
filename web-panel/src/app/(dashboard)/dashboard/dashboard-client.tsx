"use client";
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";

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
  const [asistencias, setAsistencias] = useState(initial);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setAsistencias(initial); }, [initial]);

  // Realtime granular: en vez de router.refresh() (full SSR), refrescamos
  // solo las filas afectadas en la vista v_asistencias_hoy. Si llegan
  // muchos eventos seguidos (hora pico), debounce a 400ms para batchear.
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

  const presentes = asistencias.filter((a) => a.estado === "presente").length;
  const salieron  = asistencias.filter((a) => a.estado === "salio").length;
  const ausentes  = asistencias.filter((a) => a.estado === "ausente").length;
  const total     = presentes + ausentes + salieron;
  const pct       = total > 0 ? Math.round((presentes / total) * 100) : 0;

  const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const hora  = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="page animate-fade-up">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="text-eyebrow" style={{ marginBottom: 4, textTransform: "capitalize" }}>{fecha}</p>
          <h1 className="heading-1" style={{ marginBottom: 2 }}>Dashboard</h1>
          <p className="text-muted-sm">Asistencia en tiempo real</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {hora}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: realtimeOk ? "var(--green)" : "#3f3f46",
              boxShadow: realtimeOk ? "0 0 8px rgba(34,197,94,0.6)" : "none",
            }} className={realtimeOk ? "animate-pulse-dot" : ""} />
            <span className="text-eyebrow" style={{ color: realtimeOk ? "#4ade80" : "var(--text-faint)" }}>
              {realtimeOk ? "En vivo" : "Conectando…"}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards — premium con icons + animacion stagger */}
      <div className="stagger-fade-up" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14, marginBottom: 22,
      }}>
        <StatCard
          label="Total"
          value={total}
          color="blue"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <StatCard
          label="Presentes"
          value={presentes}
          color="green"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
          delta={total > 0 ? { value: pct, label: "del total" } : null}
        />
        <StatCard
          label="Ausentes"
          value={ausentes}
          color="red"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
        <StatCard
          label="Salieron"
          value={salieron}
          color="yellow"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
        />
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>
              Asistencia del día
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 5, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${(presentes / total) * 100}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
            <div style={{ width: `${(salieron  / total) * 100}%`, background: "linear-gradient(90deg, #3b82f6, #2563eb)", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
        </div>
      )}

      {/* Activity Table */}
      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "120ms", animationFillMode: "backwards" }}>
        <div style={{
          padding: "16px 22px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
        }}>
          <div>
            <h2 className="heading-3" style={{ marginBottom: 2 }}>Actividad reciente</h2>
            <p className="text-muted-sm" style={{ fontSize: 11 }}>
              Empleados registrados hoy en las estaciones
            </p>
          </div>
          <span className="badge badge-neutral" style={{ fontVariantNumeric: "tabular-nums" }}>
            {asistencias.length} {asistencias.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {asistencias.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "auto" }}>Empleado</th>
                <th style={{ width: 160 }}>Sucursal</th>
                <th style={{ width: 120 }}>Entrada</th>
                <th style={{ width: 110 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {asistencias.map((a) => (
                <tr key={a.empleado_id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(37,99,235,0.06))",
                        border: "1px solid rgba(37,99,235,0.22)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#60a5fa",
                        flexShrink: 0,
                      }}>
                        {a.nombre_completo[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{a.nombre_completo}</span>
                    </div>
                  </td>
                  <td>{a.sucursal || "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {a.ultima_entrada
                      ? new Date(a.ultima_entrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </td>
                  <td><StatusBadge estado={a.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    presente: { cls: "badge badge-success", label: "Presente" },
    salio:    { cls: "badge badge-info",    label: "Salió" },
    ausente:  { cls: "badge badge-neutral", label: "Ausente" },
  };
  const s = map[estado] ?? map.ausente;
  return <span className={s.cls}>{s.label}</span>;
}

function EmptyState() {
  return (
    <div style={{ padding: "70px 20px", textAlign: "center" }}>
      <div style={{
        position: "relative",
        width: 64, height: 64, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.02) 100%)",
        border: "1px solid rgba(37,99,235,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 18px", color: "var(--accent-hover)",
        boxShadow: "0 10px 30px -12px rgba(37,99,235,0.5)",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {/* Pulse rings concentricos */}
        <span style={{
          position: "absolute", inset: -6, borderRadius: 20,
          border: "1px solid rgba(37,99,235,0.18)",
          animation: "pulse-ring 2.4s cubic-bezier(0.16,1,0.3,1) infinite",
        }} />
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>
        Esperando primera marcación
      </p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
        Cuando los empleados se identifiquen en las estaciones, los registros aparecerán aquí en tiempo real.
      </p>
    </div>
  );
}
