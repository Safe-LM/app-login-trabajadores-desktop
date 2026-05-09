import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { nombre, sucursal_id } = await request.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("vincular_estacion_hwid", {
    p_user_id:     user.id,
    p_nombre:      nombre.trim(),
    p_sucursal_id: sucursal_id || null,
    p_hwid:        null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ error: data?.error || "Error desconocido" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    dispositivo: {
      id:      data.dispositivo_id,
      nombre:  nombre.trim(),
      api_key: data.api_key,
    },
  });
}
