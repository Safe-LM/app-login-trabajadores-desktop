import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmpleadosClient } from "./empleados-client";

// Realtime aplica cambios CRUD al instante; SSR cada 5 min como fallback.
export const revalidate = 300;

type Empleado = {
  id: string;
  nombre: string;
  apellido: string;
  puesto: string | null;
  employee_code: string | null;
  enrollado: boolean | null;
  activo: boolean | null;
  sucursal_id: string | null;
  sucursales: { nombre: string } | null;
};
type Sucursal = { id: string; nombre: string };

export default async function EmpleadosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: rawEmp }, { data: rawSuc }] = await Promise.all([
    sb.from("empleados")
      .select("id, nombre, apellido, puesto, employee_code, enrollado, activo, sucursal_id, sucursales(nombre)")
      .order("apellido"),
    sb.from("sucursales").select("id, nombre").order("nombre"),
  ]);

  return (
    <EmpleadosClient
      empleados={(rawEmp ?? []) as Empleado[]}
      sucursales={(rawSuc ?? []) as Sucursal[]}
    />
  );
}
