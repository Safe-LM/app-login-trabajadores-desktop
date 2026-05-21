import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

type InvitarBody = {
  email?: string;
  rol?: "admin" | "viewer";
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) return NextResponse.json({ error: "sin empresa activa" }, { status: 400 });

  const body = (await request.json()) as InvitarBody;
  const email = body.email?.trim().toLowerCase();
  const rol = body.rol;

  if (!email) return NextResponse.json({ error: "email requerido" }, { status: 400 });
  if (rol !== "admin" && rol !== "viewer") {
    return NextResponse.json({ error: "rol invalido (admin o viewer)" }, { status: 400 });
  }

  // 1. Crear el registro de invitacion + generar token (RPC valida permisos).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: invitacion, error: rpcErr } = await sb.rpc("crear_invitacion", {
    p_empresa_id: empresaId,
    p_email: email,
    p_rol: rol,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  if (!invitacion?.ok) {
    return NextResponse.json({ error: invitacion?.error ?? "Error creando invitacion" }, { status: 400 });
  }

  const token: string = invitacion.token;

  // 2. Determinar URL de redirect (la pagina /invitacion/[token])
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const invitationUrl = `${origin}/invitacion/${token}`;

  // 3. Disparar el envio de email.
  //    a) Si el email NO esta en auth.users -> inviteUserByEmail (Supabase crea
  //       el usuario y manda email de signup con nuestro redirect).
  //    b) Si el email YA esta en auth.users -> generateLink('magiclink') con
  //       nuestro redirect. Supabase no envia automaticamente con generateLink,
  //       pero como esa cuenta ya existe, el usuario puede ir directamente al
  //       link (lo devolvemos en la respuesta para que el inviter lo comparta
  //       O para mostrar en UI). Caso esperado: la persona ya tiene cuenta.
  let emailSent = false;
  let manualUrl: string | null = null;
  let emailError: string | null = null;
  let serviceMisconfigured = false;

  try {
    const admin = createAdminClient();

    // Heuristica: probar inviteUserByEmail. Si falla por "ya existe", caer a
    // magic link.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: invitationUrl,
    });

    if (!inviteErr) {
      emailSent = true;
    } else {
      // Posibles mensajes: "A user with this email address has already been registered"
      const lower = inviteErr.message.toLowerCase();
      const userExists = lower.includes("already") || lower.includes("registered") || lower.includes("exists");

      if (userExists) {
        // Para usuarios existentes preferimos NO mandar magic link (les
        // crearia sesion); entregamos el invitationUrl al inviter para
        // que lo comparta — la persona ya tiene login.
        manualUrl = invitationUrl;
      } else {
        // Error genuino de Supabase Auth (SMTP rate limit, redirect_to
        // no permitido, etc.). Lo propagamos al cliente.
        emailError = inviteErr.message;
        manualUrl = invitationUrl;
      }
    }
  } catch (e) {
    // Causa tipica: SUPABASE_SERVICE_ROLE_KEY no esta seteado en el
    // entorno (caso comun en deploys Vercel donde se olvida agregar
    // la env var). Marcamos como misconfigured para que el cliente
    // muestre un mensaje claro en vez de "fallback silencioso".
    const msg = e instanceof Error ? e.message : String(e);
    serviceMisconfigured = msg.toLowerCase().includes("service_role");
    emailError = serviceMisconfigured
      ? "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor (Vercel → Settings → Environment Variables)."
      : msg;
    manualUrl = invitationUrl;
  }

  return NextResponse.json({
    ok: true,
    token,
    invitation_url: invitationUrl,
    email_sent: emailSent,
    manual_url: manualUrl,
    email_error: emailError,
    service_misconfigured: serviceMisconfigured,
  });
}
