import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

type SucursalInsert = {
  empresa_id: string;
  nombre: string;
  direccion?: string | null;
  hora_apertura?: string | null;
  hora_cierre?: string | null;
  tolerancia_min?: number;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const body = await request.json() as {
    nombre?: string;
    direccion?: string | null;
    hora_apertura?: string | null;
    hora_cierre?: string | null;
    tolerancia_min?: number | null;
  };
  const nombre = body.nombre?.trim();
  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 400 });

  if (body.hora_apertura && !TIME_RE.test(body.hora_apertura)) {
    return NextResponse.json({ error: "hora_apertura inválida (HH:MM)" }, { status: 400 });
  }
  if (body.hora_cierre && !TIME_RE.test(body.hora_cierre)) {
    return NextResponse.json({ error: "hora_cierre inválida (HH:MM)" }, { status: 400 });
  }

  const insert: SucursalInsert = {
    empresa_id: empresaId,
    nombre,
    direccion: body.direccion ?? null,
  };
  if (body.hora_apertura) insert.hora_apertura = normalizeTime(body.hora_apertura);
  if (body.hora_cierre)   insert.hora_cierre   = normalizeTime(body.hora_cierre);
  if (body.tolerancia_min != null) {
    const n = Number(body.tolerancia_min);
    if (!Number.isFinite(n) || n < 0 || n > 240) {
      return NextResponse.json({ error: "tolerancia_min fuera de rango (0-240)" }, { status: 400 });
    }
    insert.tolerancia_min = Math.round(n);
  }

  const { data, error } = await supabase
    .from("sucursales")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sucursal: data });
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}
