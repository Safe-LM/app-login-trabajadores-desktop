import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AsistenciaHoy = {
  empresa_id: string;
  empleado_id: string;
  nombre_completo: string;
  sucursal: string | null;
  ultima_entrada: string | null;
  ultima_salida: string | null;
  estado: "presente" | "ausente" | "salio";
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase.from("v_asistencias_hoy").select("*").limit(100);
  const asistencias = (raw ?? []) as AsistenciaHoy[];

  const presentes = asistencias.filter((a) => a.estado === "presente").length;
  const ausentes  = asistencias.filter((a) => a.estado === "ausente").length;
  const salieron  = asistencias.filter((a) => a.estado === "salio").length;
  const total     = presentes + ausentes + salieron;

  const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const hora  = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const pct   = total > 0 ? Math.round((presentes / total) * 100) : 0;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize", letterSpacing: "0.04em", marginBottom: 4 }}>{fecha}</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Asistencia en tiempo real</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{hora}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} className="animate-pulse-dot" />
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>En vivo</span>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total" value={total}    accent="#3b82f6" bg="rgba(59,130,246,0.06)"  border="rgba(59,130,246,0.15)"  />
        <StatCard label="Presentes" value={presentes} accent="#22c55e" bg="rgba(34,197,94,0.06)"  border="rgba(34,197,94,0.15)"  />
        <StatCard label="Ausentes"  value={ausentes}  accent="#ef4444" bg="rgba(239,68,68,0.06)"  border="rgba(239,68,68,0.15)"  />
        <StatCard label="Salieron"  value={salieron}  accent="#eab308" bg="rgba(234,179,8,0.06)"   border="rgba(234,179,8,0.15)"   />
      </div>

      {/* ── Barra de asistencia ── */}
      {total > 0 && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Asistencia del día</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${total > 0 ? (presentes / total) * 100 : 0}%`, background: "var(--green)", transition: "width 600ms ease" }} />
              <div style={{ width: `${total > 0 ? (salieron  / total) * 100 : 0}%`, background: "var(--accent)", transition: "width 600ms ease" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
            {[["#22c55e","Presentes"],["#2563eb","Salieron"],["#3f3f46","Ausentes"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {/* Tabla header */}
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Empleados hoy
          </h2>
          <span style={{
            fontSize: 11, color: "var(--text-faint)",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "2px 8px",
          }}>
            {asistencias.length} registros
          </span>
        </div>

        {/* Col headers */}
        {asistencias.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 140px 120px 100px",
            padding: "8px 20px",
            borderBottom: "1px solid var(--border)",
          }}>
            {["Empleado", "Sucursal", "Entrada", "Estado"].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
            ))}
          </div>
        )}

        {/* Filas */}
        {asistencias.length > 0 ? (
          <div>
            {asistencias.map((a, i) => (
              <div key={a.empleado_id} style={{
                display: "grid", gridTemplateColumns: "1fr 140px 120px 100px",
                padding: "10px 20px", alignItems: "center",
                borderBottom: i < asistencias.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                transition: "background 120ms", cursor: "default",
              }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {/* Nombre */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  }}>
                    {a.nombre_completo?.[0] ?? "?"}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {a.nombre_completo}
                  </span>
                </div>

                {/* Sucursal */}
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {a.sucursal ?? "—"}
                </span>

                {/* Entrada */}
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {a.ultima_entrada
                    ? new Date(a.ultima_entrada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>

                {/* Badge */}
                <StatusBadge estado={a.estado} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Sin registros hoy</p>
            <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
              {raw === null
                ? "Ejecuta el schema SQL en Supabase para activar esta vista"
                : "Los registros aparecerán cuando la estación detecte empleados"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, bg, border }: {
  label: string; value: number; accent: string; bg: string; border: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <p style={{ fontSize: 11, color: accent, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ estado }: { estado: "presente" | "ausente" | "salio" }) {
  const map = {
    presente: { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  color: "#4ade80", label: "Presente" },
    salio:    { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)", color: "#60a5fa", label: "Salió"    },
    ausente:  { bg: "rgba(63,63,70,0.4)",     border: "rgba(63,63,70,0.6)",   color: "#71717a", label: "Ausente"  },
  };
  const s = map[estado];
  return (
    <span style={{
      fontSize: 11, fontWeight: 500,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      borderRadius: 6, padding: "3px 8px", display: "inline-block", letterSpacing: "0.02em",
    }}>
      {s.label}
    </span>
  );
}
