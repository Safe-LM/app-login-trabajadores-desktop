import { createClient as _createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con service_role. Saltea RLS y habilita endpoints de auth.admin.*
 * Solo usar en API routes server-side. NUNCA exponer al cliente.
 *
 * Casos de uso:
 *   - auth.admin.inviteUserByEmail (invitar miembro nuevo)
 *   - auth.admin.generateLink (magic link para usuarios existentes)
 *   - Otros caminos privilegiados que no caben en SECURITY DEFINER de Postgres.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado");
  }
  return _createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
