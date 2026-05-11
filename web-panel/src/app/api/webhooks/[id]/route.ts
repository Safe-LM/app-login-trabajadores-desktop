import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/webhooks/:id — update (toggle activo, editar campos)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  type WebhookPatch = {
    nombre?: string;
    url?: string;
    secret?: string | null;
    eventos?: string[];
    activo?: boolean;
  };
  const patch: WebhookPatch = {};
  if (typeof body.nombre === "string") patch.nombre = body.nombre.trim();
  if (typeof body.url === "string") {
    try { new URL(body.url); } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }
    patch.url = body.url.trim();
  }
  if (body.secret !== undefined) patch.secret = body.secret?.trim() || null;
  if (Array.isArray(body.eventos)) patch.eventos = body.eventos.length > 0 ? body.eventos : ["*"];
  if (typeof body.activo === "boolean") patch.activo = body.activo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("webhooks")
    .update(patch)
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "webhook.update" as never,
    resource: `webhook:${id}`,
    metadata: { changes: patch },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/webhooks/:id
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "webhook.delete" as never,
    resource: `webhook:${id}`,
  });

  return NextResponse.json({ ok: true });
}
