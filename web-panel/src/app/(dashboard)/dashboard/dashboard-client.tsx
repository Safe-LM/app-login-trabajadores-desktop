"use client";
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge as StatusDot } from "@/components/ui/StatusBadge";
import { Users, Check, X, LogOut, CalendarRange } from "lucide-react";

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

  // Orden: presentes primero (los que importan ahora), luego salieron, luego ausentes.
  // Dentro de cada grupo, por hora de entrada más reciente.
  const ORDEN: Record<string, number> = { presente: 0, salio: 1, ausente: 2 };
  const asistenciasOrdenadas = [...asistencias].sort((a, b) => {
    const d = (ORDEN[a.estado] ?? 3) - (ORDEN[b.estado] ?? 3);
    if (d !== 0) return d;
    return (b.ultima_entrada ?? "").localeCompare(a.ultima_entrada ?? "");
  });

  // Reloj client-side. Evita hydration mismatch — new Date() en render
  // genera valores distintos en SSR vs cliente.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);
  const fecha = now?.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) ?? "";
  const hora  = now?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) ?? "—:—";

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
          <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {hora}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <StatusDot
              kind={realtimeOk ? "live" : "offline"}
              label={realtimeOk ? "En vivo" : "Conectando…"}
              strong={realtimeOk}
            />
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
          icon={<Users size={11} strokeWidth={2.25} />}
        />
        <StatCard
          label="Presentes"
          value={presentes}
          color="green"
          icon={<Check size={11} strokeWidth={2.75} />}
          delta={total > 0 ? { value: pct, label: "del total" } : null}
        />
        <StatCard
          label="Ausentes"
          value={ausentes}
          color="red"
          icon={<X size={11} strokeWidth={2.5} />}
        />
        <StatCard
          label="Salieron"
          value={salieron}
          color="yellow"
          icon={<LogOut size={11} strokeWidth={2.25} />}
        />
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card" style={{ padding: "14px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>
              Asistencia del día
            </span>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: "var(--radius-pill)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${(presentes / total) * 100}%`, background: "#22c55e", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
            <div style={{ width: `${(salieron  / total) * 100}%`, background: "var(--accent)", transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
        </div>
      )}

      {/* Activity Table */}
      <div className="card animate-fade-up" style={{ overflow: "hidden", animationDelay: "120ms", animationFillMode: "backwards" }}>
        <div style={{
          padding: "14px 22px",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
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
                <th style={{ width: 150 }}>Sucursal</th>
                <th style={{ width: 90 }}>Entrada</th>
                <th style={{ width: 90 }}>Salida</th>
                <th style={{ width: 100 }}>En oficina</th>
                <th style={{ width: 110 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {asistenciasOrdenadas.map((a) => {
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
                          <span className="animate-pulse-dot" style={{
                            position: "absolute", top: -1, right: -1,
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#4ade80", boxShadow: "0 0 6px #4ade80",
                            border: "1.5px solid var(--bg-card)",
                          }} />
                        )}
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{a.nombre_completo}</span>
                    </div>
                  </td>
                  <td>{a.sucursal || <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {a.ultima_entrada
                      ? new Date(a.ultima_entrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                      : <span style={{ color: "var(--text-faint)" }}>—</span>}
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {a.ultima_salida
                      ? new Date(a.ultima_salida).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                      : <span style={{ color: "var(--text-faint)" }}>—</span>}
                  </td>
                  <td style={{ fontVariantNumeric: "tabular-nums", color: horas ? "#4ade80" : "var(--text-faint)" }} title={horas ? "Tiempo en oficina (sesión actual)" : undefined}>
                    {horas ?? "—"}
                  </td>
                  <td><AttendanceBadge estado={a.estado} /></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

// Tiempo en oficina de la sesión actual (ahora − última entrada).
// Solo para empleados presentes; es preciso porque mide desde su último
// fichaje de entrada hasta ahora. Para los que ya salieron devolvemos null
// (el total real requeriría todos los pares, que esta vista no expone).
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

function EmptyState() {
  return (
    <div style={{ padding: "56px 20px", textAlign: "center" }}>
      <div style={{
        width: 52, height: 52, borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px", color: "var(--text-faint)",
      }}>
        <CalendarRange size={22} strokeWidth={1.5} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.01em" }}>
        Esperando primera marcación
      </p>
      <p style={{ fontSize: 12, color: "var(--text-faint)", maxWidth: 340, margin: "0 auto", lineHeight: 1.6 }}>
        Cuando los empleados se identifiquen en las estaciones, los registros aparecerán aquí en tiempo real.
      </p>
    </div>
  );
}
