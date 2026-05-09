import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="animate-fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Reportes</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Analisis de asistencia</p>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "56px 20px", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Reportes en desarrollo</p>
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Proxima actualizacion incluira graficas y exportacion a Excel/PDF</p>
      </div>
    </div>
  );
}
