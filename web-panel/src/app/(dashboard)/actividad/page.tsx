import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActividadClient } from "./actividad-client";

export const revalidate = 60;

export default async function ActividadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Cargar en paralelo las dos fuentes de actividad: audit_log (admin)
  // y logs_estacion (station).
  const [{ data: auditRaw }, { data: stationRaw }, { data: dispositivos }] = await Promise.all([
    sb.from("audit_log")
      .select("id, action, resource, metadata, actor_email, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("logs_estacion")
      .select("id, dispositivo_id, tipo, detalle, creado_en")
      .order("creado_en", { ascending: false })
      .limit(200),
    sb.from("dispositivos").select("id, nombre"),
  ]);

  return (
    <ActividadClient
      auditEntries={auditRaw ?? []}
      stationLogs={stationRaw ?? []}
      dispositivos={dispositivos ?? []}
    />
  );
}
