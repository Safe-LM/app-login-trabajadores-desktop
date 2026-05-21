import { createClient } from "@/lib/supabase/server";
import { InvitacionClient } from "./invitacion-client";
import { headers } from "next/headers";

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

export default async function InvitacionPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

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
