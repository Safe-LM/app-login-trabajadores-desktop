import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/me/empresa-activa  - lista empresas del usuario actual
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("mis_empresas");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, empresas: data ?? [] });
}

// POST /api/me/empresa-activa  - cambiar empresa activa
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { empresa_id } = (await request.json()) as { empresa_id?: string };
  if (!empresa_id) return NextResponse.json({ error: "empresa_id requerido" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("cambiar_empresa_activa", { p_empresa_id: empresa_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error }, { status: 400 });
  return NextResponse.json(data);
}
