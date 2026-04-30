import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800, margin: "0 auto" }} className="animate-fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 2 }}>Configuracion</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Ajustes de tu empresa</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { title: "Perfil de empresa", desc: "Nombre, logo, zona horaria" },
          { title: "Sucursales", desc: "Gestionar ubicaciones y zonas" },
          { title: "Integraciones", desc: "API keys y webhooks" },
          { title: "Notificaciones", desc: "Email y alertas en tiempo real" },
        ].map((s) => (
          <div key={s.title} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{s.title}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: "16px 20px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Zona de peligro</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Estas acciones son irreversibles.</p>
        <button style={{
          padding: "8px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#f87171", cursor: "pointer",
        }}>
          Eliminar empresa
        </button>
      </div>
    </div>
  );
}
