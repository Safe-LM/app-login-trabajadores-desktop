import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

/**
 * Elimina una marcacion. Requiere razon obligatoria (auditoria).
 * Body: { id, razon }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { id, razon } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (!razon?.trim() || razon.trim().length < 4) {
    return NextResponse.json({ error: "Razón obligatoria (mínimo 4 caracteres)" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Leer antes para audit
  const { data: prev } = await sb
    .from("registros_asistencia")
    .select("id, tipo, timestamp, empleado_id")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (!prev) {
    return NextResponse.json({ error: "Marcación no encontrada" }, { status: 404 });
  }

  const { error } = await sb
    .from("registros_asistencia")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "asistencia.delete" as never,
    resource: `asistencia:${id}`,
    metadata: {
      empleado_id: prev.empleado_id,
      tipo_eliminado: prev.tipo,
      timestamp_eliminado: prev.timestamp,
      razon: razon.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
