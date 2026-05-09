import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { empresa, sucursal } = await request.json();

  if (!empresa?.nombre?.trim()) {
    return NextResponse.json({ error: "Nombre de empresa requerido" }, { status: 400 });
  }

  const slug = empresa.nombre
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36);

  // Usar funcion SECURITY DEFINER que bypasea RLS
  const { data, error } = await supabase.rpc("crear_empresa_onboarding", {
    p_user_id:  user.id,
    p_nombre:   empresa.nombre.trim(),
    p_slug:     slug,
    p_timezone: empresa.timezone || "America/Mexico_City",
    p_sucursal: sucursal?.nombre?.trim() || null,
    p_ciudad:   sucursal?.ciudad?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ error: data?.error || "Error desconocido" }, { status: 500 });

  return NextResponse.json({ ok: true, empresa_id: data.empresa_id });
}
