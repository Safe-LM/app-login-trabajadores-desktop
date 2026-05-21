import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/invitaciones/[token]  - preview publico (sin auth)
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("ver_invitacion", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error }, { status: 404 });
  return NextResponse.json(data);
}

// POST /api/invitaciones/[token]  - aceptar (autenticado)
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("aceptar_invitacion", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, error: data?.error }, { status: 400 });
  return NextResponse.json(data);
}
