import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { ReportesSkeleton } from "./reportes-skeleton";
import type { ReportesData } from "./types";

const ReportesClient = dynamic(
  () => import("./reportes-client").then(m => ({ default: m.ReportesClient })),
  { loading: () => <ReportesSkeleton /> }
);

export const revalidate = 60;

const RANGE_DAYS = 30;

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  const desde = new Date();
  desde.setDate(desde.getDate() - RANGE_DAYS);
  desde.setHours(0, 0, 0, 0);

  const [registrosRes, empleadosRes, sucursalesRes] = await Promise.all([
    supabase
      .from("registros_asistencia")
      .select("id, tipo, timestamp, confianza, empleado_id, sucursal_id, empleados(nombre, apellido), sucursales(nombre)")
      .eq("empresa_id", empresaId)
      .gte("timestamp", desde.toISOString())
      .order("timestamp", { ascending: false })
      .limit(5000),
    supabase
      .from("empleados")
      .select("id, nombre, apellido, sucursal_id, activo")
      .eq("empresa_id", empresaId),
    supabase
      .from("sucursales")
      .select("id, nombre, hora_apertura, hora_cierre, tolerancia_min")
      .eq("empresa_id", empresaId),
  ]);

  type RegistroJoined = {
    id: string;
    tipo: "entrada" | "salida";
    timestamp: string;
    confianza: number | null;
    empleado_id: string;
    sucursal_id: string | null;
    empleados: { nombre: string; apellido: string } | null;
    sucursales: { nombre: string } | null;
  };

  const registrosRaw = (registrosRes.data ?? []) as unknown as RegistroJoined[];

  const data: ReportesData = {
    desde: desde.toISOString(),
    rangeDays: RANGE_DAYS,
    registros: registrosRaw.map(r => ({
      id: r.id,
      tipo: r.tipo,
      timestamp: r.timestamp,
      confianza: r.confianza,
      empleado_id: r.empleado_id,
      sucursal_id: r.sucursal_id,
      empleado_nombre: r.empleados ? `${r.empleados.nombre} ${r.empleados.apellido}` : null,
      sucursal_nombre: r.sucursales?.nombre ?? null,
    })),
    empleados: (empleadosRes.data ?? []).map(e => ({
      id: e.id,
      nombre: `${e.nombre} ${e.apellido}`,
      sucursal_id: e.sucursal_id,
      activo: e.activo,
    })),
    sucursales: (sucursalesRes.data ?? []).map(s => ({
      id: s.id,
      nombre: s.nombre,
      hora_apertura: s.hora_apertura,
      hora_cierre: s.hora_cierre,
      tolerancia_min: s.tolerancia_min ?? 10,
    })),
  };

  return (
    <div className="page animate-fade-up">
      <div className="page-header">
        <div>
          <h1 className="heading-1" style={{ marginBottom: 2 }}>Reportes</h1>
          <p className="text-muted-sm">Análisis de asistencia, puntualidad y horas trabajadas</p>
        </div>
      </div>
      <ReportesClient data={data} />
    </div>
  );
}
