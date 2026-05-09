
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AsistenciaClient } from "./asistencia-client";

export const revalidate = 20;

export default async function AsistenciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase
    .from("registros_asistencia")
    .select("id, tipo, timestamp, confianza, empleados(nombre, apellido), sucursales(nombre)")
    .order("timestamp", { ascending: false })
    .limit(100);

  const registros = (raw ?? []) as any[];

  return <AsistenciaClient registros={registros} />;
}
