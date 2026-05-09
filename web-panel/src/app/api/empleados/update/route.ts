import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id, nombre, apellido, puesto, employee_code, sucursal_id, activo } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!nombre?.trim() || !apellido?.trim())
    return NextResponse.json({ error: "Nombre y apellido requeridos" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("empleados")
    .update({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      puesto: puesto?.trim() || null,
      employee_code: employee_code?.trim() || null,
      sucursal_id: sucursal_id || null,
      activo: activo ?? true,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
