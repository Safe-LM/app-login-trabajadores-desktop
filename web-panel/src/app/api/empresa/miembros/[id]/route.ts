import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type PatchBody = { rol?: "admin" | "viewer" } | { transferir_ownership?: true };

// PATCH /api/empresa/miembros/[id]  - cambiar rol o transferir ownership
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const body = (await request.json()) as PatchBody;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  if ("transferir_ownership" in body && body.transferir_ownership) {
    const { data, error } = await sb.rpc("transferir_ownership", { p_a_membresia_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ error: data?.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if ("rol" in body && (body.rol === "admin" || body.rol === "viewer")) {
    const { data, error } = await sb.rpc("cambiar_rol_miembro", {
      p_membresia_id: id,
      p_nuevo_rol: body.rol,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.ok) return NextResponse.json({ error: data?.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "body invalido" }, { status: 400 });
}

// DELETE /api/empresa/miembros/[id]  - quitar miembro
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("quitar_miembro", { p_membresia_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ error: data?.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
