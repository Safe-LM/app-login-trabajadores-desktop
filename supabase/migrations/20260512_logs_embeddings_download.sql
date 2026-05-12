-- Nuevos tipos de log para diagnostico del download de embeddings.
-- Sin estos, el bug de "pgvector falla silenciosamente" era invisible
-- para el admin (la station devolvia False y caia al fallback sin
-- registrar nada en Supabase).

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
  'embeddings_fallback_local'::text
]));
