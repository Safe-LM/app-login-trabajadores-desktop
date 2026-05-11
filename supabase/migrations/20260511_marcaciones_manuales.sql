-- S2.1: Edicion manual de marcaciones con auditoria
-- En vez de tabla aparte (mas joins, mas RLS), anadir columnas a
-- registros_asistencia. audit_log cubre el historial completo.

alter table public.registros_asistencia
  add column if not exists editado_por        uuid references auth.users(id) on delete set null,
  add column if not exists editado_en         timestamptz,
  add column if not exists razon_edicion      text,
  add column if not exists original_timestamp timestamptz,
  add column if not exists creado_manual      boolean not null default false;

comment on column public.registros_asistencia.editado_por        is 'Admin que edito la marcacion (NULL si auto/station)';
comment on column public.registros_asistencia.editado_en         is 'Cuando se hizo la edicion';
comment on column public.registros_asistencia.razon_edicion      is 'Justificacion textual obligatoria al editar (auditoria laboral)';
comment on column public.registros_asistencia.original_timestamp is 'Timestamp original antes de la edicion (para diff)';
comment on column public.registros_asistencia.creado_manual      is 'True si lo creo un admin desde el panel (no la station)';

create index if not exists registros_asistencia_editado_por_idx
  on public.registros_asistencia(editado_por) where editado_por is not null;
