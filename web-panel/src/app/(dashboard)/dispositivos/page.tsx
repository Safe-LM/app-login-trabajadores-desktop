import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DispositivosClient } from "./dispositivos-client";

export const revalidate = 30;

type Dispositivo = {
  id: string;
  nombre: string;
  activo: boolean;
  ip_local: string | null;
  hostname: string | null;
  heartbeat_at: string | null;
  version_app: string | null;
  api_key: string;
  config: Record<string, unknown>;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  estado_conexion: "online" | "alerta" | "offline" | "nunca";
  segundos_desde_heartbeat: number | null;
  creado_por: string | null;
  hwid: string | null;
  empleados_count: number;
  health_score: number;
  ultimo_sync_at: string | null;
  encodings_version: number;
  camara_ok: boolean | null;
};

type Sucursal = { id: string; nombre: string };

export default async function DispositivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Paralelizar las 2 queries — antes el cliente pedía sucursales después de hidratar (~300ms)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dispRes, sucRes] = await Promise.all([
    (supabase as any).from("v_dispositivos_estado").select("*").order("nombre"),
    supabase.from("sucursales").select("id, nombre").order("nombre"),
  ]);

  const dispositivos = (dispRes.data ?? []) as Dispositivo[];
  const sucursales   = (sucRes.data  ?? []) as Sucursal[];

  return <DispositivosClient dispositivos={dispositivos} initialSucursales={sucursales} />;
}
