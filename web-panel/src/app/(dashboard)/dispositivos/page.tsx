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
};

export default async function DispositivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from("v_dispositivos_estado")
    .select("*")
    .order("nombre");

  const dispositivos = (raw ?? []) as Dispositivo[];

  return <DispositivosClient dispositivos={dispositivos} />;
}
