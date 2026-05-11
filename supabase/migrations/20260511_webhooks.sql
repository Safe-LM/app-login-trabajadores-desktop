-- S2.5: webhooks salientes para notificar a sistemas externos.

create table if not exists public.webhooks (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nombre      text not null,
  url         text not null,
  secret      text,
  activo      boolean not null default true,
  eventos     text[] not null default array['*']::text[],
  ultimo_enviado_at timestamptz,
  ultimo_status     int,
  ultimo_error      text,
  total_enviados    bigint not null default 0,
  total_fallidos    bigint not null default 0,
  creado_en   timestamptz not null default now(),
  creado_por  uuid references auth.users(id) on delete set null
);

create index if not exists webhooks_empresa_idx on public.webhooks(empresa_id) where activo = true;

alter table public.webhooks enable row level security;

drop policy if exists "webhooks select empresa" on public.webhooks;
create policy "webhooks select empresa"
on public.webhooks for select to authenticated
using (empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid);

drop policy if exists "webhooks insert empresa" on public.webhooks;
create policy "webhooks insert empresa"
on public.webhooks for insert to authenticated
with check (empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid);

drop policy if exists "webhooks update empresa" on public.webhooks;
create policy "webhooks update empresa"
on public.webhooks for update to authenticated
using (empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid)
with check (empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid);

drop policy if exists "webhooks delete empresa" on public.webhooks;
create policy "webhooks delete empresa"
on public.webhooks for delete to authenticated
using (empresa_id = (auth.jwt() -> 'user_metadata' ->> 'empresa_id')::uuid);

comment on table public.webhooks is 'Endpoints HTTP a los que se envian notificaciones de la empresa.';
