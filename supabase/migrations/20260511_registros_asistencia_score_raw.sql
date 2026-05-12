-- A7: tracking real de calidad del reconocimiento facial.

alter table public.registros_asistencia
  add column if not exists score_raw       double precision check (score_raw is null or (score_raw >= 0 and score_raw <= 1)),
  add column if not exists metodo          text,
  add column if not exists embedding_count int;

comment on column public.registros_asistencia.score_raw is
  'Cosine similarity raw del match (0-1). NULL si fue manual o sin facial.';
comment on column public.registros_asistencia.metodo is
  'Motor que produjo el match: sface_v3, photo_matcher, gemini, manual, fallback.';
comment on column public.registros_asistencia.embedding_count is
  'Numero de embeddings del empleado al momento del match (calidad del enroll).';

create index if not exists registros_asistencia_score_raw_idx
  on public.registros_asistencia(score_raw) where score_raw is not null;
