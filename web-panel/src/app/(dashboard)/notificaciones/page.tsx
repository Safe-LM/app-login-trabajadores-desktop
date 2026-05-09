import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificacionesClient } from "./notificaciones-client";
import type { NotificacionRow } from "@/types/database";

// Realtime hidrata cambios; SSR fallback cada 5 min.
export const revalidate = 300;

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notificaciones")
    .select("*")
    .order("creada_en", { ascending: false })
    .limit(200);

  return <NotificacionesClient initial={(data ?? []) as NotificacionRow[]} />;
}
