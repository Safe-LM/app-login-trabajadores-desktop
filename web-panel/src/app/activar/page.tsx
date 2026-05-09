import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivarClient } from "./activar-client";

type Empresa = { id: string; nombre: string };
type Sucursal = { id: string; empresa_id: string; nombre: string };

export default async function ActivarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim().toUpperCase();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = `/activar${token ? `?token=${token}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // Cargar empresas y sucursales que el usuario puede gestionar
  const { data: empresasRaw } = await supabase
    .from("empresas")
    .select("id, nombre")
    .order("nombre");

  const { data: sucursalesRaw } = await supabase
    .from("sucursales")
    .select("id, empresa_id, nombre")
    .order("nombre");

  const empresas = (empresasRaw ?? []) as Empresa[];
  const sucursales = (sucursalesRaw ?? []) as Sucursal[];

  return (
    <ActivarClient
      initialToken={token}
      empresas={empresas}
      sucursales={sucursales}
    />
  );
}
