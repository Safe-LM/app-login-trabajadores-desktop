
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "empresa_id missing" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Defensa en profundidad: ademas de RLS, filtrar por empresa_id
  // para que un admin de empresa A nunca pueda borrar empleados de B
  // aunque conozca el id.
  const { error } = await supabase
    .from("empleados")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) {
    // Distinguir entre constraint violation (asistencias) y otros
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("foreign key") || msg.includes("constraint")) {
      return NextResponse.json({ error: "No se puede eliminar el empleado porque tiene registros de asistencia." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message ?? "Error al eliminar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
