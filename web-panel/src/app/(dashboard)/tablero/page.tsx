import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TableroClient } from "./tablero-client";

export const revalidate = 30;

export type EstacionTile = {
  id: string;
  nombre: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;
  estado_conexion: "online" | "alerta" | "offline" | "nunca";
  segundos_desde_heartbeat: number | null;
  health_score: number;
  empleados_count: number;
  version_app: string | null;
  ip_local: string | null;
  ultimo_sync_at: string | null;
  camara_ok: boolean | null;
};

export type MarcacionReciente = {
  empleado_id: string;
  empleado_nombre: string;
  sucursal_nombre: string | null;
  dispositivo_id: string | null;
  tipo: "entrada" | "salida";
  timestamp: string;
};

export default async function TableroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dispRes, marcRes] = await Promise.all([
    (supabase as any).from("v_dispositivos_estado").select("*").order("nombre"),
    supabase
      .from("registros_asistencia")
      .select("empleado_id, dispositivo_id, sucursal_id, tipo, timestamp, empleados(nombre, apellido), sucursales(nombre)")
      .eq("empresa_id", empresaId)
      .order("timestamp", { ascending: false })
      .limit(8),
  ]);

  const estaciones = (dispRes.data ?? []) as EstacionTile[];

  type MarcRaw = {
    empleado_id: string;
    dispositivo_id: string | null;
    tipo: "entrada" | "salida";
    timestamp: string;
    empleados: { nombre: string; apellido: string } | null;
    sucursales: { nombre: string } | null;
  };
  const marcaciones: MarcacionReciente[] = ((marcRes.data ?? []) as unknown as MarcRaw[]).map(m => ({
    empleado_id: m.empleado_id,
    empleado_nombre: m.empleados ? `${m.empleados.nombre} ${m.empleados.apellido}` : "—",
    sucursal_nombre: m.sucursales?.nombre ?? null,
    dispositivo_id: m.dispositivo_id,
    tipo: m.tipo,
    timestamp: m.timestamp,
  }));

  return <TableroClient estaciones={estaciones} marcaciones={marcaciones} />;
}
