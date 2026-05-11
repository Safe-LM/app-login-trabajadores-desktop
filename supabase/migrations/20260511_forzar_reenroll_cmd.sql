-- S2.2: nuevo tipo de comando 'forzar_reenroll' para que el panel
-- pueda forzar regeneracion de embeddings de UN empleado especifico
-- (cambio de look: barba, lentes, embedding malo, etc.)

alter table public.comandos_estacion drop constraint if exists comandos_estacion_tipo_check;

alter table public.comandos_estacion add constraint comandos_estacion_tipo_check
check (tipo = any (array[
  'sync_empleados'::text,
  'reiniciar_app'::text,
  'limpiar_cache'::text,
  'forzar_reenroll'::text  -- payload: { empleado_id }
]));
