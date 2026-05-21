import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) return NextResponse.json({ error: "sin empresa activa" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [miembrosRes, invitacionesRes] = await Promise.all([
    sb.rpc("listar_miembros", { p_empresa_id: empresaId }),
    sb.from("empresa_invitaciones")
      .select("id, email, rol, expira_en, created_at, invitado_por")
      .eq("empresa_id", empresaId)
      .is("aceptada_en", null)
      .is("cancelada_en", null)
      .order("created_at", { ascending: false }),
  ]);

  if (miembrosRes.error) return NextResponse.json({ error: miembrosRes.error.message }, { status: 500 });
  if (invitacionesRes.error) return NextResponse.json({ error: invitacionesRes.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    miembros: miembrosRes.data ?? [],
    invitaciones_pendientes: invitacionesRes.data ?? [],
  });
}
