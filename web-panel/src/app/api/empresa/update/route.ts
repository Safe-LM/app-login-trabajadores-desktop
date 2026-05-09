import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type EmpresaUpdate = {
  nombre?: string;
  timezone?: string;
  logo_url?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const empresaId = user.user_metadata?.empresa_id;
    if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 400 });

    const body = await req.json() as Partial<{ nombre: unknown; timezone: unknown; logo_url: unknown }>;
    const update: EmpresaUpdate = {};

    if ("nombre" in body && typeof body.nombre === "string") {
      const nombre = body.nombre.trim();
      if (nombre.length < 2) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
      update.nombre = nombre;
    }
    if ("timezone" in body && typeof body.timezone === "string") {
      update.timezone = body.timezone.trim();
    }
    if ("logo_url" in body) {
      if (body.logo_url == null) update.logo_url = null;
      else if (typeof body.logo_url === "string") update.logo_url = body.logo_url.trim() || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
    }

    const { error } = await supabase
      .from("empresas")
      .update(update)
      .eq("id", empresaId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
