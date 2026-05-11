import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

// GET /api/webhooks — listar
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("webhooks")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("creado_en", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [] });
}

// POST /api/webhooks — crear
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { nombre, url, secret, eventos } = body;

  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!url?.trim()) return NextResponse.json({ error: "URL requerida" }, { status: 400 });
  try { new URL(url); } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("webhooks")
    .insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      url: url.trim(),
      secret: secret?.trim() || null,
      eventos: Array.isArray(eventos) && eventos.length > 0 ? eventos : ["*"],
      activo: true,
      creado_por: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "webhook.create" as never,
    resource: `webhook:${data.id}`,
    metadata: { nombre, url, eventos },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
