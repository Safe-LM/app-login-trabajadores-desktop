import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EjecutivoClient } from "./ejecutivo-client";

export const revalidate = 300; // 5 min

export default async function EjecutivoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("v_kpis_sucursal_30d")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("total_entradas", { ascending: false });

  return <EjecutivoClient kpis={data ?? []} />;
}
