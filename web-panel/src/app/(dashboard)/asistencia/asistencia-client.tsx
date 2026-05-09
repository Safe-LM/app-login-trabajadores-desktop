
"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Registro = {
  id: string;
  tipo: "entrada" | "salida";
  timestamp: string;
  confianza: number | null;
  empleados: { nombre: string; apellido: string } | null;
  sucursales: { nombre: string } | null;
};

export function AsistenciaClient({ registros: initial }: { registros: Registro[] }) {
  const [dateFilter, setDateFilter] = useState("");
  const [registros, setRegistros] = useState(initial);
  const [liveCount, setLiveCount] = useState(0);

  // Realtime: nuevos registros aparecen al instante sin refrescar
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("asistencia-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "registros_asistencia" },
        async (payload) => {
          const r = payload.new as { id: string; empleado_id: string; sucursal_id: string | null };
          // Hidratar empleados/sucursales (la suscripción no incluye los joins)
          const { data } = await supabase
            .from("registros_asistencia")
            .select("id, tipo, timestamp, confianza, empleados(nombre, apellido), sucursales(nombre)")
            .eq("id", r.id)
            .single();
          if (data) {
            const hydrated = data as unknown as Registro;
            setRegistros((prev) => {
              if (prev.some((x) => x.id === hydrated.id)) return prev;
              return [hydrated, ...prev].slice(0, 100);
            });
            setLiveCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = registros.filter((r) => {
    if (!dateFilter) return true;
    const rDate = new Date(r.timestamp).toISOString().split("T")[0];
    return rDate === dateFilter;
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Asistencia</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Historial de registros y auditoría</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase" }}>Filtrar por fecha</label>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{
              padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", colorScheme: "dark"
            }} />
          </div>
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Registros de asistencia</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: "#4ade80", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "2px 6px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
              EN VIVO{liveCount > 0 ? ` · ${liveCount}` : ""}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-faint)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>
            {filtered.length} encontrados
          </span>
        </div>

        {filtered.length > 0 ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 90px", padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
              {["Empleado", "Sucursal", "Fecha y Hora", "Tipo", "Confianza"].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
              ))}
            </div>
            {filtered.map((r, i) => (
              <div key={r.id} style={{
                display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 90px",
                padding: "12px 20px", alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", opacity: 0.8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {r.empleados?.nombre?.[0] ?? "?"}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : "—"}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.sucursales?.nombre ?? "—"}</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                    {new Date(r.timestamp).toLocaleDateString("es-MX")}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 8px", display: "inline-block", textAlign: "center",
                  background: r.tipo === "entrada" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                  border: `1px solid ${r.tipo === "entrada" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`,
                  color: r.tipo === "entrada" ? "#4ade80" : "#60a5fa",
                }}>{r.tipo === "entrada" ? "ENTRADA" : "SALIDA"}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "80px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>No se encontraron registros</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Intenta con otro filtro de fecha o rango.</p>
          </div>
        )}
      </div>
    </div>
  );
}
