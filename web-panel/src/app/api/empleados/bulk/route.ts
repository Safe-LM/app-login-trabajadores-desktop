import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const { employees } = await request.json();
  if (!employees || !Array.isArray(employees)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Mapear campos de Excel a base de datos
  const dataToInsert = employees.map((emp: any) => ({
    empresa_id: empresaId,
    nombre: emp.Nombre || emp.nombre || "",
    apellido: emp.Apellido || emp.apellido || "",
    puesto: emp.Puesto || emp.puesto || null,
    employee_code: (emp.Codigo || emp.codigo || emp.ID || "").toString(),
    activo: true,
    enrollado: false,
  }));

  const { error } = await supabase
    .from("empleados")
    .insert(dataToInsert);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: dataToInsert.length });
}
