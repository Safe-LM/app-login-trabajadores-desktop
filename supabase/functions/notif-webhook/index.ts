// Edge Function: notif-webhook
//
// Recibe via pg_net (trigger sobre notificaciones) un payload con el
// row insertado y dispara HTTP POST a cada webhook activo de la empresa
// que matchee el tipo de notificacion.
//
// Para activar:
//   1. supabase functions deploy notif-webhook
//   2. Configurar el trigger SQL (ver migration 20260511_webhook_trigger.sql)
//
// Headers que envia a cada webhook:
//   - Content-Type: application/json
//   - X-SafeLink-Event: <tipo de evento>
//   - X-SafeLink-Secret: <secret del webhook si esta configurado>
//   - User-Agent: SafeLink-Webhook/1.0

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface NotifPayload {
  id: string;
  empresa_id: string;
  tipo: string;
  severidad: "info" | "warn" | "error" | "critical";
  titulo: string;
  mensaje: string | null;
  metadata: Record<string, unknown> | null;
  creada_en: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let notif: NotifPayload;
  try {
    const body = await req.json();
    // pg_net manda { record } o { new } segun el trigger
    notif = (body.record ?? body.new ?? body) as NotifPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!notif?.empresa_id || !notif?.tipo) {
    return new Response("Missing fields", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE!);

  // Buscar webhooks activos de la empresa que matcheen el tipo
  const { data: webhooks, error } = await supabase
    .from("webhooks")
    .select("id, url, secret, eventos")
    .eq("empresa_id", notif.empresa_id)
    .eq("activo", true);

  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
  if (!webhooks || webhooks.length === 0) {
    return new Response(JSON.stringify({ ok: true, dispatched: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Filtrar por eventos ('*' o tipo exacto)
  const matching = webhooks.filter((w) =>
    w.eventos.includes("*") || w.eventos.includes(notif.tipo)
  );

  const results = await Promise.all(matching.map(async (w) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SafeLink-Webhook/1.0",
      "X-SafeLink-Event": notif.tipo,
    };
    if (w.secret) headers["X-SafeLink-Secret"] = w.secret;

    const payload = {
      event: notif.tipo,
      severity: notif.severidad,
      title: notif.titulo,
      message: notif.mensaje,
      metadata: notif.metadata,
      timestamp: notif.creada_en,
      notification_id: notif.id,
    };

    let status: number | null = null;
    let errMsg: string | null = null;
    try {
      const r = await fetch(w.url, {
        method: "POST", headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      status = r.status;
    } catch (e) {
      errMsg = (e as Error).message;
    }

    const ok = status != null && status >= 200 && status < 300;
    // Actualizar stats
    await supabase.rpc("incrementar_stats_webhook", {
      p_webhook_id: w.id,
      p_ok: ok,
      p_status: status,
      p_error: errMsg,
    }).then(() => null).catch(() => null);

    return { webhook_id: w.id, ok, status, error: errMsg };
  }));

  return new Response(JSON.stringify({
    ok: true,
    dispatched: results.length,
    results,
  }), { headers: { "Content-Type": "application/json" } });
});
