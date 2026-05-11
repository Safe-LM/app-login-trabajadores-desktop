-- Ampliar tipos de logs_estacion para incluir eventos de entrenamiento facial.
-- Permite al admin debugear cuando un empleado no se reconoce desde el panel.

alter table public.logs_estacion drop constraint if exists logs_estacion_tipo_check;

alter table public.logs_estacion add constraint logs_estacion_tipo_check
check (tipo = any (array[
  'sync_ok'::text,
  'sync_error'::text,
  'reconocimiento_ok'::text,
  'reconocimiento_fallo'::text,
  'asistencia_registrada'::text,
  'asistencia_offline'::text,
  'camara_error'::text,
  'camara_ok'::text,
  'error'::text,
  'info'::text,
  -- Nuevos: entrenamiento facial
  'training_started'::text,         -- station inicio el proceso de generar embeddings
  'training_completed'::text,       -- termino — incluye empleados procesados y fallidos
  'embedding_generated'::text,      -- por empleado: foto procesada OK
  'embedding_failed'::text,         -- por empleado: no se detecto rostro / foto invalida
  'foto_descargada'::text,          -- foto descargada de Supabase Storage al cache local
  'foto_error_descarga'::text       -- no se pudo descargar la foto
]));

comment on column public.logs_estacion.tipo is
  'Tipo de evento. training_* y embedding_* para debug del entrenamiento facial.';
