import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id, nombre, sucursal_id, activo } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const updateData: any = {};
  if (nombre !== undefined) updateData.nombre = nombre.trim();
  if (sucursal_id !== undefined) updateData.sucursal_id = sucursal_id || null;
  if (activo !== undefined) updateData.activo = !!activo;

  const { error } = await supabase
    .from("dispositivos")
    .update(updateData)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
