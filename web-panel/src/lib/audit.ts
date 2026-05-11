/**
 * Audit log — helper para registrar acciones del admin en Supabase.
 *
 * Tabla esperada: audit_log
 *   id          uuid PK default gen_random_uuid()
 *   empresa_id  uuid (FK empresas)
 *   actor_id    uuid (FK auth.users)
 *   actor_email text
 *   action      text  ej: "empleado.create", "dispositivo.delete"
 *   resource    text  ej: "empleado:abc-123"
 *   metadata    jsonb cambios, contexto, antes/despues
 *   ip          text
 *   user_agent  text
 *   created_at  timestamptz default now()
 *
 * RLS: select solo si empresa_id = current_empresa_id().
 *
 * Si la tabla no existe todavia, los logs fallan en silencio para no
 * romper la app. Crear la tabla via migracion Supabase cuando se
 * habilite el audit log en produccion.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "empleado.create"
  | "empleado.update"
  | "empleado.delete"
  | "empleado.bulk_import"
  | "dispositivo.create"
  | "dispositivo.update"
  | "dispositivo.delete"
  | "dispositivo.revoke"
  | "sucursal.create"
  | "sucursal.update"
  | "sucursal.delete"
  | "empresa.update"
  | "config.update";

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra una accion en audit_log. Pensado para llamarse desde
 * endpoints API server-side donde ya tenemos supabase + user.
 *
 * No-op silencioso si la tabla aun no existe (primer deploy).
 */
export async function auditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  ctx: {
    empresaId: string;
    actorId: string;
    actorEmail?: string;
    ip?: string;
    userAgent?: string;
  },
  entry: AuditEntry,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("audit_log").insert({
      empresa_id:  ctx.empresaId,
      actor_id:    ctx.actorId,
      actor_email: ctx.actorEmail ?? null,
      action:      entry.action,
      resource:    entry.resource,
      metadata:    entry.metadata ?? null,
      ip:          ctx.ip ?? null,
      user_agent:  ctx.userAgent ?? null,
    });
  } catch (e) {
    // No-op. Si la tabla no existe (primer deploy) o la insercion
    // falla, NO queremos que la accion principal se reverse.
    console.warn("[audit] log fallido (no-op):", (e as Error).message);
  }
}

/**
 * Extrae IP y User-Agent de un Request de Next.js. Usar en endpoints
 * para enriquecer los logs.
 */
export function extractRequestMeta(request: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;
  return { ip, userAgent };
}
