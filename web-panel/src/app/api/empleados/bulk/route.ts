import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { auditLog, extractRequestMeta } from "@/lib/audit";

type ExcelRow = Record<string, unknown>;

function pickStr(row: ExcelRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const { employees } = await request.json();
  if (!employees || !Array.isArray(employees)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Validacion server-side: descartar filas con nombre/apellido vacios.
  // Antes el filtro estaba solo en el cliente -> filas Excel sin datos
  // generaban empleados fantasma con nombre vacio en la BD.
  const valid: Array<{
    empresa_id: string;
    nombre: string;
    apellido: string;
    puesto: string | null;
    employee_code: string;
    activo: boolean;
    enrollado: boolean;
  }> = [];
  let skipped = 0;

  for (const raw of employees as ExcelRow[]) {
    const nombre   = pickStr(raw, "Nombre", "nombre");
    const apellido = pickStr(raw, "Apellido", "apellido");
    if (!nombre || !apellido) { skipped++; continue; }

    valid.push({
      empresa_id: empresaId,
      nombre,
      apellido,
      puesto: pickStr(raw, "Puesto", "puesto") || null,
      employee_code: pickStr(raw, "Codigo", "codigo", "ID", "id"),
      activo: true,
      enrollado: false,
    });
  }

  if (valid.length === 0) {
    return NextResponse.json({
      error: "Ninguna fila válida — todas tenían nombre o apellido vacíos.",
      skipped,
    }, { status: 400 });
  }

  const { error } = await supabase
    .from("empleados")
    .insert(valid);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log: registro de import masivo (sin datos personales, solo conteos)
  const meta = extractRequestMeta(request);
  await auditLog(supabase, {
    empresaId, actorId: user.id, actorEmail: user.email ?? undefined,
    ip: meta.ip ?? undefined, userAgent: meta.userAgent ?? undefined,
  }, {
    action: "empleado.bulk_import",
    resource: `empresa:${empresaId}`,
    metadata: { inserted: valid.length, skipped },
  });

  return NextResponse.json({ ok: true, inserted: valid.length, skipped });
}
