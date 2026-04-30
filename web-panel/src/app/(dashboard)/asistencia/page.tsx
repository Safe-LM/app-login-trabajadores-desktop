import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AsistenciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("registros_asistencia")
    .select("id, tipo, timestamp, confianza, empleados(nombre, apellido), sucursales(nombre)")
    .order("timestamp", { ascending: false })
    .limit(100);

  type Registro = {
    id: string;
    tipo: "entrada" | "salida";
    timestamp: string;
    confianza: number | null;
    empleados: { nombre: string; apellido: string } | null;
    sucursales: { nombre: string } | null;
  };
  const registros = (raw ?? []) as Registro[];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Asistencia</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Historial de registros</p>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Ultimos registros</h2>
          <span style={{ fontSize: 11, color: "var(--text-faint)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px" }}>
            {registros.length} registros
          </span>
        </div>

        {registros.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 90px", padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
            {["Empleado", "Sucursal", "Hora", "Tipo", "Confianza"].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
            ))}
          </div>
        )}

        {registros.length > 0 ? registros.map((r, i) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 90px",
            padding: "10px 20px", alignItems: "center",
            borderBottom: i < registros.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0 }}>
                {r.empleados?.nombre?.[0] ?? "?"}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                {r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : "—"}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.sucursales?.nombre ?? "—"}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 500, borderRadius: 6, padding: "3px 8px", display: "inline-block",
              background: r.tipo === "entrada" ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)",
              border: `1px solid ${r.tipo === "entrada" ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`,
              color: r.tipo === "entrada" ? "#4ade80" : "#60a5fa",
            }}>{r.tipo === "entrada" ? "Entrada" : "Salida"}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {r.confianza != null ? `${Math.round(r.confianza * 100)}%` : "—"}
            </span>
          </div>
        )) : (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Sin registros</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Los registros apareceran cuando la estacion detecte empleados</p>
          </div>
        )}
      </div>
    </div>
  );
}
