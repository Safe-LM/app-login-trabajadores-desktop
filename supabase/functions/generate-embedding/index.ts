/**
 * Supabase Edge Function: generate-embedding
 *
 * Marca empleados como pendientes de generar embedding.
 * El embedding real se genera en la estación durante el sync.
 *
 * Flujo:
 * 1. Admin sube foto → Web Panel
 * 2. Web Panel llama esta Edge Function
 * 3. Esta función marca el empleado como "enrollado=false"
 * 4. Durante sync, la estación detecta empleados no enrollados
 * 5. La estación descarga fotos, genera embeddings, y marca enrollado=true
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  foto_url: string;
  empleado_id: string;
  empresa_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, supabaseKey);

    const { foto_url, empleado_id, empresa_id }: RequestBody = await req.json();

    if (!foto_url || !empleado_id || !empresa_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Faltan parámetros: foto_url, empleado_id, empresa_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Registrando empleado ${empleado_id} - foto: ${foto_url}`);

    // Marcar empleado como pendiente de enrollment
    const { error: updateError } = await client
      .from("empleados")
      .update({
        foto_url: foto_url,
        enrollado: false,  // La estación lo marcará true tras generar embedding
      })
      .eq("id", empleado_id)
      .eq("empresa_id", empresa_id);

    if (updateError) {
      console.error("Error actualizando empleado:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Empleado ${empleado_id} marcado para enrollment`);

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje: "Empleado registrado - la estación generará el embedding durante el sync",
        empleado_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en generate-embedding:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});