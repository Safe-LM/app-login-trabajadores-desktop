import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

/**
 * Crea una marcacion manual (cuando un empleado se le olvido fichar).
 * Body: { empleado_id, tipo, timestamp, sucursal_id?, razon }
 *
 * Marca creado_manual=true + editado_por para auditoria. Tambien
 * inserta en audit_log para historial inmutable.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { empleado_id, tipo, timestamp, sucursal_id, razon } = body;

  // Validacion
  if (!empleado_id) return NextResponse.json({ error: "empleado_id requerido" }, { status: 400 });
  if (tipo !== "entrada" && tipo !== "salida") {
    return NextResponse.json({ error: "tipo debe ser 'entrada' o 'salida'" }, { status: 400 });
  }
  if (!timestamp) return NextResponse.json({ error: "timestamp requerido" }, { status: 400 });
  if (!razon?.trim() || razon.trim().length < 4) {
    return NextResponse.json({ error: "Razón obligatoria (mínimo 4 caracteres)" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data, error } = await sb
    .from("registros_asistencia")
    .insert({
      empresa_id: empresaId,
      empleado_id,
      sucursal_id: sucursal_id || null,
      tipo,
      timestamp,
      reconocimiento_facial: false,
      sincronizado: true,
      creado_manual: true,
      editado_por: user.id,
      editado_en: new Date().toISOString(),
      razon_edicion: razon.trim(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log inmutable
  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "asistencia.create_manual" as never,
    resource: `asistencia:${data.id}`,
    metadata: { empleado_id, tipo, timestamp, razon: razon.trim() },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
