import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

/**
 * S2.2: fuerza que TODAS las stations de la empresa regeneren los
 * embeddings de un empleado especifico.
 *
 * Pasos:
 * 1. Marca empleado.enrollado = false (gatilla regeneracion en proximo sync).
 * 2. Borra los embeddings_faciales del empleado (se reconstruyen).
 * 3. Emite comando 'forzar_reenroll' a cada dispositivo de la empresa
 *    para que actue YA, sin esperar el heartbeat.
 * 4. Audit log.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const { empleado_id } = await request.json();
  if (!empleado_id) return NextResponse.json({ error: "empleado_id requerido" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Validar tenancy
  const { data: emp, error: empErr } = await sb
    .from("empleados")
    .select("id, nombre, apellido")
    .eq("id", empleado_id)
    .eq("empresa_id", empresaId)
    .single();
  if (empErr || !emp) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  // 1. Marcar como no enrollado
  await sb.from("empleados").update({ enrollado: false })
    .eq("id", empleado_id).eq("empresa_id", empresaId);

  // 2. Borrar embeddings actuales
  await sb.from("embeddings_faciales").delete()
    .eq("empleado_id", empleado_id).eq("empresa_id", empresaId);

  // 3. Emitir comando a cada station activa de la empresa
  const { data: stations } = await sb
    .from("dispositivos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  let notificadas = 0;
  if (stations && stations.length > 0) {
    const rows = stations.map((s: { id: string }) => ({
      dispositivo_id: s.id,
      empresa_id: empresaId,
      tipo: "forzar_reenroll",
      payload: { empleado_id },
    }));
    const { error: cmdErr } = await sb.from("comandos_estacion").insert(rows);
    if (!cmdErr) notificadas = rows.length;
  }

  // 4. Audit log
  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "empleado.forzar_reenroll" as never,
    resource: `empleado:${empleado_id}`,
    metadata: {
      empleado: `${emp.nombre} ${emp.apellido}`,
      stations_notificadas: notificadas,
    },
  });

  return NextResponse.json({ ok: true, stations_notificadas: notificadas });
}
