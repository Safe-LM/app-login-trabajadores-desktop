import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  const body = await request.json();
  const { nombre, apellido, puesto, employee_code, sucursal_id, activo, foto } = body;

  if (!nombre?.trim() || !apellido?.trim())
    return NextResponse.json({ error: "Nombre y apellido requeridos" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Insertar empleado sin foto_url todavía
  const { data: emp, error: insertErr } = await sb
    .from("empleados")
    .insert({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      puesto: puesto?.trim() || null,
      employee_code: employee_code?.trim() || null,
      sucursal_id: sucursal_id || null,
      empresa_id: empresaId,
      activo: activo ?? true,
      enrollado: false,
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  let fotoUrl: string | null = null;

  // 2. Si hay foto base64, subirla a Storage
  if (foto) {
    try {
      const base64Data = (foto as string).replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const ext = (foto as string).startsWith("data:image/png") ? "png" : "jpg";
      const storagePath = `${empresaId}/${emp.id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("fotos-empleados")
        .upload(storagePath, buffer, { contentType: `image/${ext}`, upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("fotos-empleados")
          .getPublicUrl(storagePath);
        fotoUrl = urlData.publicUrl;

        await sb.from("empleados").update({
          foto_url: fotoUrl,
          enrollado: false, // Se marcará true después de generar embedding
        }).eq("id", emp.id);
      }
    } catch (e) {
      console.error("Error subiendo foto:", e);
    }
  }

  // 3. Generar embedding usando Edge Function (solo si hay foto)
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
            empleado_id: emp.id,
            empresa_id: empresaId,
          }),
        }
      );

      const edgeData = await edgeRes.json();
      console.log("Edge function result:", edgeData);

      if (!edgeData.ok) {
        console.error("Edge function error:", edgeData.error);
        // No bloqueamos - el empleado quedó creado, embedding se puede generar después
      }
    } catch (e) {
      console.error("Error invocando edge function:", e);
    }
  }

  // 4. Notificar a todas las estaciones de la empresa para sync inmediato
  await sb.rpc("notificar_sync_empleados", { p_empresa_id: empresaId }).then(() => {}).catch(() => {});

  return NextResponse.json({ ok: true, id: emp.id, foto_url: fotoUrl });
}
