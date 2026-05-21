import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Auth callback que intercambia el `code` que Supabase pone en la URL
 * tras un email magic-link (invite, signup, recovery) por una sesion
 * real persistida en cookies. Sin este intercambio, el navegador queda
 * sin sesion y el middleware redirige a /login.
 *
 * Flow:
 *   1. Supabase manda email con link a /auth/verify?token=...&type=invite
 *      &redirect_to=https://app.com/auth/confirm?next=/invitacion/abc
 *   2. Supabase verifica el token, redirige a redirect_to con ?code=...
 *   3. Esta ruta corre exchangeCodeForSession(code) -> guarda cookies
 *   4. Redirige al `next` (la pagina de aceptar invitacion)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const reason = encodeURIComponent(error.message);
    return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  }

  // Sesion creada. Redirigir al destino original (ej. /invitacion/[token]).
  // Validamos que `next` sea un path relativo para evitar open-redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
