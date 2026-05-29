import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapaClient } from "./mapa-client";

export const revalidate = 60;

export type EstacionMapa = {
  id: string;
  nombre: string;
  estado_conexion: string;
  ip_local: string | null;
  version_app: string | null;
  camara_ok: boolean | null;
};

export type SucursalMapa = {
  id: string;
  nombre: string;
  direccion: string | null;
  activa: boolean;
  lat: number | null;
  lng: number | null;
  estaciones_total: number;
  estaciones_online: number;
  estaciones: EstacionMapa[];
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
    (supabase as any).from("v_dispositivos_estado").select("id, nombre, sucursal_id, estado_conexion, ip_local, version_app, camara_ok"),
  ]);

  type DispEstado = {
    id: string;
    nombre: string;
    sucursal_id: string | null;
    estado_conexion: string;
    ip_local: string | null;
    version_app: string | null;
    camara_ok: boolean | null;
  };
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
      estaciones: ofSucursal.map(d => ({
        id: d.id,
        nombre: d.nombre,
        estado_conexion: d.estado_conexion,
        ip_local: d.ip_local,
        version_app: d.version_app,
        camara_ok: d.camara_ok,
      })),
    };
  });

  return <MapaClient sucursales={sucursales} />;
}
