import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SucursalesClient } from "./sucursales-client";

export const revalidate = 60;

export default async function SucursalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) redirect("/onboarding");

  const { data: sucursales } = await supabase
    .from("sucursales")
    .select("id, nombre, direccion, activa, hora_apertura, hora_cierre, tolerancia_min, lat, lng")
    .eq("empresa_id", empresaId)
    .order("nombre");

  const rows = (sucursales ?? []).map(s => ({
    id: s.id,
    nombre: s.nombre,
    direccion: s.direccion,
    activa: s.activa,
    hora_apertura: s.hora_apertura,
    hora_cierre: s.hora_cierre,
    tolerancia_min: s.tolerancia_min ?? 10,
    lat: s.lat,
    lng: s.lng,
  }));

  return <SucursalesClient sucursales={rows} />;
}
