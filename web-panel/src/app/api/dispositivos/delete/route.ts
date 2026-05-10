
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "empresa_id missing" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Defensa en profundidad: filtrar por empresa_id ademas de id.
  const { error } = await supabase
    .from("dispositivos")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
