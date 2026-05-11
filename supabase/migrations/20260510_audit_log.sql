-- Tabla audit_log: registro de acciones administrativas del panel.
-- Para auditoria interna, compliance B2B, y debugging.
--
-- Para aplicar:
--   supabase db push
-- O via SQL Editor en el dashboard.

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  resource    text not null,
  metadata    jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_empresa_idx     on public.audit_log(empresa_id, created_at desc);
create index if not exists audit_log_actor_idx       on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_action_idx      on public.audit_log(action, created_at desc);
create index if not exists audit_log_resource_idx    on public.audit_log(resource);

alter table public.audit_log enable row level security;

-- Solo lectura: usuarios de la empresa pueden ver SOLO sus logs.
drop policy if exists "audit_log select por empresa" on public.audit_log;
create policy "audit_log select por empresa"
on public.audit_log for select
using (
  empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid
);

-- Insert: solo el backend con service_role. Usuarios NO pueden insertar
-- directamente para evitar logs falsificados desde el cliente.
drop policy if exists "audit_log insert solo backend" on public.audit_log;
create policy "audit_log insert solo backend"
on public.audit_log for insert
with check (false);

-- No update ni delete: los logs son inmutables (compliance).

comment on table  public.audit_log is 'Registro de acciones del panel admin para auditoria. Inmutable.';
comment on column public.audit_log.action   is 'Ej: empleado.create, dispositivo.delete';
comment on column public.audit_log.resource is 'Identificador del recurso afectado. Ej: empleado:abc-123';
comment on column public.audit_log.metadata is 'Contexto adicional: before/after, campos modificados, etc.';
