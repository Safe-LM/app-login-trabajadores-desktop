import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const { nombre, apellido, puesto, employee_code, sucursal_id } = await request.json();
  if (!nombre?.trim() || !apellido?.trim())
    return NextResponse.json({ error: "Nombre y apellido requeridos" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("empleados")
    .insert({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      puesto: puesto?.trim() || null,
      employee_code: employee_code?.trim() || null,
      sucursal_id: sucursal_id || null,
      empresa_id: empresaId,
      activo: true,
      enrollado: false,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
