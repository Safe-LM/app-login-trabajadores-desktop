import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

type SucursalUpdate = {
  nombre?: string;
  direccion?: string | null;
  activa?: boolean;
  hora_apertura?: string | null;
  hora_cierre?: string | null;
  tolerancia_min?: number;
  lat?: number | null;
  lng?: number | null;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const body = await request.json() as {
    id?: string;
    nombre?: string;
    direccion?: string | null;
    activa?: boolean;
    hora_apertura?: string | null;
    hora_cierre?: string | null;
    tolerancia_min?: number | null;
    lat?: number | null;
    lng?: number | null;
  };
  const { id } = body;
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const update: SucursalUpdate = {};
  if (body.nombre !== undefined) update.nombre = String(body.nombre).trim();
  if (body.direccion !== undefined) update.direccion = body.direccion;
  if (body.activa !== undefined) update.activa = !!body.activa;

  if (body.hora_apertura !== undefined) {
    if (body.hora_apertura !== null && !TIME_RE.test(String(body.hora_apertura))) {
      return NextResponse.json({ error: "hora_apertura inválida (HH:MM)" }, { status: 400 });
    }
    update.hora_apertura = body.hora_apertura ? normalizeTime(body.hora_apertura) : null;
  }
  if (body.hora_cierre !== undefined) {
    if (body.hora_cierre !== null && !TIME_RE.test(String(body.hora_cierre))) {
      return NextResponse.json({ error: "hora_cierre inválida (HH:MM)" }, { status: 400 });
    }
    update.hora_cierre = body.hora_cierre ? normalizeTime(body.hora_cierre) : null;
  }
  if (body.tolerancia_min !== undefined && body.tolerancia_min !== null) {
    const n = Number(body.tolerancia_min);
    if (!Number.isFinite(n) || n < 0 || n > 240) {
      return NextResponse.json({ error: "tolerancia_min fuera de rango (0-240)" }, { status: 400 });
    }
    update.tolerancia_min = Math.round(n);
  }
  if (body.lat !== undefined || body.lng !== undefined) {
    if (body.lat === null || body.lng === null) {
      // explicit clear
      update.lat = null;
      update.lng = null;
    } else {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!Number.isFinite(lat) || lat < -90  || lat > 90)  return NextResponse.json({ error: "lat fuera de rango (-90 a 90)" },   { status: 400 });
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) return NextResponse.json({ error: "lng fuera de rango (-180 a 180)" }, { status: 400 });
      update.lat = lat;
      update.lng = lng;
    }
  }

  const { error } = await supabase
    .from("sucursales")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}
