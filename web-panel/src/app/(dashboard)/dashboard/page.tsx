
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

// Realtime con debounce actualiza filas afectadas en vivo; SSR solo
// cada 5 min como fallback (cambio de fecha, primera carga, etc.).
export const revalidate = 300;

type AsistenciaHoy = {
  empresa_id: string;
  empleado_id: string;
  nombre_completo: string;
  sucursal: string | null;
  ultima_entrada: string | null;
  ultima_salida: string | null;
  estado: "presente" | "ausente" | "salio";
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("v_asistencias_hoy")
    .select("*")
    .limit(100);

  const asistencias = (raw ?? []) as AsistenciaHoy[];

  return <DashboardClient initial={asistencias} />;
}
