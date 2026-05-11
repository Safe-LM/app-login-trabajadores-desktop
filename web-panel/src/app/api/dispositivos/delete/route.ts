
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

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

  // Audit log (no-op si tabla aun no existe)
  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "dispositivo.delete",
    resource: `dispositivo:${id}`,
  });

  return NextResponse.json({ ok: true });
}
