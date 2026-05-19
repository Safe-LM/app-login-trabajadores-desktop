-- Telemetria del reconocimiento facial en la estacion.
-- Se agregan eventos para diagnosticar "no detecta empleado" sin
-- necesitar acceso fisico a la station — todo se ve desde el panel.
--
-- Antes solo teniamos 'reconocimiento_ok' y 'reconocimiento_fallo':
-- granularidad insuficiente para saber si el problema era el thread
-- (nunca arranco), la quality gate (frame oscuro), el detector
-- (no encuentra cara) o el matcher (no llega al threshold).

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
  'training_started'::text,
  'training_completed'::text,
  'embedding_generated'::text,
  'embedding_failed'::text,
  'foto_descargada'::text,
  'foto_error_descarga'::text,
  'embeddings_download_started'::text,
  'embeddings_download_ok'::text,
  'embeddings_download_failed'::text,
  'embeddings_fallback_local'::text,
  -- Nuevos: telemetria del thread de reconocimiento (v5.6.7+)
  'recognition_init'::text,
  'recognition_unavailable'::text,
  'recognition_ready'::text,
  'recognition_init_error'::text,
  'recognition_thread_started'::text,
  'recognition_thread_stopped'::text,
  'recognition_match'::text,
  'recognition_no_match'::text,
  'recognition_error'::text,
  'enrollment_no_bbox'::text
]));
