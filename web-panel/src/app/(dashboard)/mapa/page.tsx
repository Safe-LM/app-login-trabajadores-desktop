import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapaClient } from "./mapa-client";

export const revalidate = 60;

export type SucursalMapa = {
  id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  lat: number | null;
  lng: number | null;
  estaciones_total: number;
  estaciones_online: number;
};

export default async function MapaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sucRes, dispRes] = await Promise.all([
    supabase.from("sucursales").select("id, nombre, direccion, activa, lat, lng").eq("empresa_id", empresaId).order("nombre"),
    (supabase as any).from("v_dispositivos_estado").select("sucursal_id, estado_conexion"),
  ]);

  type DispEstado = { sucursal_id: string | null; estado_conexion: string };
  const disps = (dispRes.data ?? []) as DispEstado[];

  const sucursales: SucursalMapa[] = (sucRes.data ?? []).map(s => {
    const ofSucursal = disps.filter(d => d.sucursal_id === s.id);
    return {
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      activa: s.activa,
      lat: s.lat,
      lng: s.lng,
      estaciones_total: ofSucursal.length,
      estaciones_online: ofSucursal.filter(d => d.estado_conexion === "online").length,
    };
  });

  return <MapaClient sucursales={sucursales} />;
}
