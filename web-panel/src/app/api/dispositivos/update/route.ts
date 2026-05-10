import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type DispositivosUpdate = {
  nombre?: string;
  sucursal_id?: string | null;
  activo?: boolean;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "empresa_id missing" }, { status: 403 });

  const { id, nombre, sucursal_id, activo } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  // Allowlist explicito de campos para evitar mass-assignment.
  const updateData: DispositivosUpdate = {};
  if (typeof nombre === "string") updateData.nombre = nombre.trim();
  if (sucursal_id !== undefined) updateData.sucursal_id = sucursal_id || null;
  if (activo !== undefined) updateData.activo = !!activo;

  // Defensa en profundidad: filtrar por empresa_id.
  const { error } = await supabase
    .from("dispositivos")
    .update(updateData)
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
