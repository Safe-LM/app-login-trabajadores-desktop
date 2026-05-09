import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConfiguracionClient } from "./configuracion-client";

export const revalidate = 120;

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) redirect("/onboarding");

  const [empresaRes, sucursalesRes] = await Promise.all([
    supabase
      .from("empresas")
      .select("*")
      .eq("id", empresaId)
      .single(),
    supabase
      .from("sucursales")
      .select("id, nombre, hora_apertura, hora_cierre, tolerancia_min, activa")
      .eq("empresa_id", empresaId)
      .order("nombre"),
  ]);

  const empresa = empresaRes.data;
  if (!empresa) {
    return (
      <div className="page">
        <div className="empty-state">
          <p className="heading-3">Empresa no encontrada</p>
          <p className="text-muted-sm">Contacta a soporte si el problema persiste.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-up">
      <div className="page-header">
        <div>
          <h1 className="heading-1" style={{ marginBottom: 2 }}>Configuración</h1>
          <p className="text-muted-sm">Ajustes globales de tu organización</p>
        </div>
      </div>
      <ConfiguracionClient
        empresa={{
          id: empresa.id,
          nombre: empresa.nombre,
          slug: empresa.slug,
          timezone: empresa.timezone || "America/Mexico_City",
          logo_url: empresa.logo_url,
        }}
        sucursales={(sucursalesRes.data ?? []).map(s => ({
          id: s.id,
          nombre: s.nombre,
          hora_apertura: s.hora_apertura,
          hora_cierre: s.hora_cierre,
          tolerancia_min: s.tolerancia_min ?? 10,
          activa: s.activa,
        }))}
      />
    </div>
  );
}
