import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { id, nombre, apellido, puesto, employee_code, sucursal_id, activo, foto } = body;

  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const updateData: Record<string, unknown> = {};
  if (nombre !== undefined)      updateData.nombre      = nombre.trim();
  if (apellido !== undefined)    updateData.apellido    = apellido.trim();
  if (puesto !== undefined)      updateData.puesto      = puesto?.trim() || null;
  if (employee_code !== undefined) updateData.employee_code = employee_code?.trim() || null;
  if (sucursal_id !== undefined) updateData.sucursal_id = sucursal_id || null;
  if (activo !== undefined)      updateData.activo      = !!activo;

  let fotoUrl: string | null = null;

  // Si hay nueva foto, subirla a Storage y generar embedding
  if (foto) {
    try {
      const base64Data = (foto as string).replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = (foto as string).startsWith("data:image/png") ? "png" : "jpg";
      const storagePath = `${empresaId}/${id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("fotos-empleados")
        .upload(storagePath, buffer, { contentType: `image/${ext}`, upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("fotos-empleados")
          .getPublicUrl(storagePath);
        fotoUrl = urlData.publicUrl;
        updateData.foto_url = fotoUrl;
        updateData.enrollado = false; // Se marcará true después de generar embedding
      }
    } catch (e) {
      console.error("Error subiendo foto en update:", e);
    }
  }

  const { error } = await sb.from("empleados").update(updateData).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generar nuevo embedding si hay nueva foto
  if (fotoUrl) {
    try {
      const edgeRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-embedding`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            foto_url: fotoUrl,
            empleado_id: id,
            empresa_id: empresaId,
          }),
        }
      );

      const edgeData = await edgeRes.json();
      if (!edgeData.ok) {
        console.error("Edge function error:", edgeData.error);
      }
    } catch (e) {
      console.error("Error invocando edge function:", e);
    }
  }

  // Notificar a todas las estaciones de la empresa para sync inmediato
  await sb.rpc("notificar_sync_empleados", { p_empresa_id: empresaId }).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true });
}
