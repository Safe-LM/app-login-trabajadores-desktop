import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/webhooks/:id/test — manda un payload de prueba al webhook
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id;
  if (!empresaId) return NextResponse.json({ error: "sin empresa" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: hook, error } = await sb
    .from("webhooks")
    .select("id, url, secret, nombre")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (error || !hook) return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 });

  const payload = {
    event: "test",
    empresa_id: empresaId,
    timestamp: new Date().toISOString(),
    titulo: "Prueba de webhook",
    mensaje: `Si recibes este mensaje, el webhook "${hook.nombre}" funciona.`,
    metadata: { test: true, sent_by: user.email ?? null },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SafeLink-Webhook/1.0",
    "X-SafeLink-Event": "test",
  };
  if (hook.secret) headers["X-SafeLink-Secret"] = hook.secret;

  let status: number | null = null;
  let bodyText = "";
  let errMsg: string | null = null;
  try {
    const r = await fetch(hook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    status = r.status;
    bodyText = await r.text().then((t) => t.slice(0, 500)).catch(() => "");
  } catch (e) {
    errMsg = (e as Error).message ?? "fetch failed";
  }

  // Actualizar stats del webhook
  await sb.from("webhooks").update({
    ultimo_enviado_at: new Date().toISOString(),
    ultimo_status: status,
    ultimo_error: errMsg,
  }).eq("id", id).eq("empresa_id", empresaId);

  const ok = status != null && status >= 200 && status < 300;
  return NextResponse.json({ ok, status, response: bodyText, error: errMsg });
}
