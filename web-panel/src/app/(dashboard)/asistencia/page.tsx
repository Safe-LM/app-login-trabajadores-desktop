
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AsistenciaClient } from "./asistencia-client";

export const revalidate = 300;

export default async function AsistenciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cargar en paralelo: registros recientes + opciones de filtros.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [
    { data: rawReg },
    { data: rawEmp },
    { data: rawSuc },
  ] = await Promise.all([
    sb.from("registros_asistencia")
      .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, empleados(nombre, apellido), sucursales(nombre)")
      .order("timestamp", { ascending: false })
      .limit(100),
    sb.from("empleados").select("id, nombre, apellido").order("apellido"),
    sb.from("sucursales").select("id, nombre").order("nombre"),
  ]);

  return (
    <AsistenciaClient
      registros={rawReg ?? []}
      empleados={rawEmp ?? []}
      sucursales={rawSuc ?? []}
    />
  );
}
