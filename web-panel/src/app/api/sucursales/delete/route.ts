
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const { error } = await supabase
    .from("sucursales")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: "No se puede eliminar la sucursal porque tiene registros asociados." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
