-- PARTE 2: RLS (ejecutar DESPUÉS de que la Parte 1 haya corrido exitosamente)

create or replace function auth_empresa_id()
returns uuid
language sql stable security definer
as $$
  select coalesce(
    (auth.jwt() -> 'raw_user_meta_data' ->> 'empresa_id')::uuid,
    (auth.jwt() -> 'user_metadata'      ->> 'empresa_id')::uuid
  );
$$;

alter table empresas             enable row level security;
alter table sucursales           enable row level security;
alter table empleados            enable row level security;
alter table embeddings_faciales  enable row level security;
alter table dispositivos         enable row level security;
alter table registros_asistencia enable row level security;

drop policy if exists "empresa_propia"              on empresas;
drop policy if exists "sucursales_propia_empresa"   on sucursales;
drop policy if exists "empleados_propia_empresa"    on empleados;
drop policy if exists "embeddings_propia_empresa"   on embeddings_faciales;
drop policy if exists "dispositivos_propia_empresa" on dispositivos;
drop policy if exists "asistencia_propia_empresa"   on registros_asistencia;

create policy "empresa_propia"              on empresas             for all using (id         = auth_empresa_id());
create policy "sucursales_propia_empresa"   on sucursales           for all using (empresa_id = auth_empresa_id());
create policy "empleados_propia_empresa"    on empleados            for all using (empresa_id = auth_empresa_id());
create policy "embeddings_propia_empresa"   on embeddings_faciales  for all using (empresa_id = auth_empresa_id());
create policy "dispositivos_propia_empresa" on dispositivos         for all using (empresa_id = auth_empresa_id());
create policy "asistencia_propia_empresa"   on registros_asistencia for all using (empresa_id = auth_empresa_id());
