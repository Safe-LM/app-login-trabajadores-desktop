import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EquipoClient } from "./equipo-client";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [empresaRes, miembrosRes, invitacionesRes] = await Promise.all([
    sb.from("empresas").select("id, nombre").eq("id", empresaId).single(),
    sb.rpc("listar_miembros", { p_empresa_id: empresaId }),
    sb.from("empresa_invitaciones")
      .select("id, email, rol, expira_en, created_at, invitado_por")
      .eq("empresa_id", empresaId)
      .is("aceptada_en", null)
      .is("cancelada_en", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <EquipoClient
      empresaNombre={empresaRes.data?.nombre ?? "Tu empresa"}
      miembrosIniciales={miembrosRes.data ?? []}
      invitacionesIniciales={invitacionesRes.data ?? []}
      currentUserId={user.id}
    />
  );
}
