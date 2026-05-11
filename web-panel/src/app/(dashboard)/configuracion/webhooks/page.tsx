import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WebhooksClient } from "./webhooks-client";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const empresaId = user.user_metadata?.empresa_id as string | undefined;
  if (!empresaId) redirect("/onboarding");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("webhooks")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("creado_en", { ascending: false });

  return <WebhooksClient initial={data ?? []} />;
}
