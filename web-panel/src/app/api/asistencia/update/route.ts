import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

/**
 * Edita el timestamp/tipo de una marcacion existente.
 * Guarda original_timestamp (si no estaba) + editado_por + razon.
 * Body: { id, timestamp?, tipo?, razon }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { id, timestamp, tipo, razon } = body;

  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (!razon?.trim() || razon.trim().length < 4) {
    return NextResponse.json({ error: "Razón obligatoria (mínimo 4 caracteres)" }, { status: 400 });
  }
  if (tipo && tipo !== "entrada" && tipo !== "salida") {
    return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Leer el registro actual para guardar before y validar tenancy
  const { data: prev, error: readErr } = await sb
    .from("registros_asistencia")
    .select("id, empresa_id, tipo, timestamp, original_timestamp")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (readErr || !prev) {
    return NextResponse.json({ error: "Marcación no encontrada" }, { status: 404 });
  }

  // 2. Armar update con allowlist + preservar original_timestamp
  type AsistenciaUpdate = {
    timestamp?: string;
    tipo?: "entrada" | "salida";
    original_timestamp?: string;
    editado_por: string;
    editado_en: string;
    razon_edicion: string;
  };
  const updateData: AsistenciaUpdate = {
    editado_por: user.id,
    editado_en: new Date().toISOString(),
    razon_edicion: razon.trim(),
  };
  if (timestamp && timestamp !== prev.timestamp) {
    updateData.timestamp = timestamp;
    // Guardar el timestamp original solo en la primera edicion
    if (!prev.original_timestamp) {
      updateData.original_timestamp = prev.timestamp;
    }
  }
  if (tipo && tipo !== prev.tipo) {
    updateData.tipo = tipo;
  }

  const { error } = await sb
    .from("registros_asistencia")
    .update(updateData)
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. Audit log con before/after
  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "asistencia.update" as never,
    resource: `asistencia:${id}`,
    metadata: {
      before: { tipo: prev.tipo, timestamp: prev.timestamp },
      after:  { tipo: tipo ?? prev.tipo, timestamp: timestamp ?? prev.timestamp },
      razon: razon.trim(),
    },
  });

  return NextResponse.json({ ok: true });
}
