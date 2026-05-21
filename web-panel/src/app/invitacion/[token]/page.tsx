import { createClient } from "@/lib/supabase/server";
import { InvitacionClient } from "./invitacion-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type InvitacionPreview = {
  ok: true;
  email: string;
  rol: "admin" | "viewer";
  empresa_id: string;
  empresa_nombre: string;
  expira_en: string;
} | {
  ok: false;
  error: string;
};

export default async function InvitacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string; type?: string }>;
}) {
  const { token } = await params;
  const { code } = await searchParams;
  const supabase = await createClient();

  // Manejo defensivo: si Supabase nos mando aqui directamente con un
  // ?code= (caso de invitaciones generadas antes del fix que usaba
  // /auth/confirm), intercambiamos el code aqui mismo y redirigimos
  // a la URL limpia. Asi el flujo funciona aunque el email tenga el
  // redirect_to "viejo".
  if (code) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeErr) {
      // Sesion creada -> reload limpio para que las cookies se aplique
      redirect(`/invitacion/${token}`);
    }
    // Si falla, seguimos como si no hubiera code (el usuario vera el
    // boton "Iniciar sesion"). El error real lo ignoramos silenciosamente
    // para no romper la pagina publica.
  }

  // Preview publica via RPC ver_invitacion (GRANT TO anon)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: preview } = await sb.rpc("ver_invitacion", { p_token: token }) as { data: InvitacionPreview | null };

  // Estado actual del usuario
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email?.toLowerCase() ?? null;

  // Detectar si el usuario es "recien invitado" y aun no completo su cuenta:
  //   - Esta autenticado (vino del magic link)
  //   - El email coincide con la invitacion
  //   - No tiene full_name todavia en metadata (heuristica fiable: si se
  //     registro via signup normal o crear_empresa_onboarding tendria datos;
  //     si vino por inviteUserByEmail, los metadatas vienen vacios)
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const isInvitedFresh =
    !!user &&
    !!preview && preview.ok &&
    user.email?.toLowerCase() === preview.email &&
    !fullName.trim();

  // Headers solo para asegurar SSR fresh
  await headers();

  return (
    <InvitacionClient
      token={token}
      preview={preview}
      userEmail={userEmail}
      isAuthenticated={!!user}
      needsAccountSetup={isInvitedFresh}
    />
  );
}
