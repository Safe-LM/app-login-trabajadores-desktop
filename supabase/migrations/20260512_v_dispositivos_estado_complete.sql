-- Fix: la vista v_dispositivos_estado solo exponia 13 columnas y faltaban
-- 8 que el panel necesita: empleados_count, encodings_version,
-- ultimo_sync_at, camara_ok, health_score, hwid, creado_por, ultima_ip.
--
-- Sintoma: el panel mostraba 'EMPLEADOS: 0', 'CÁMARA: —', 'SALUD: 0/100'
-- aunque la station YA habia actualizado los valores en la tabla raw.
-- Esos campos llegaban como `undefined` al cliente y la UI los pintaba
-- como vacios.
--
-- CREATE OR REPLACE VIEW no acepta reordenar columnas, por eso DROP+CREATE.

DROP VIEW IF EXISTS public.v_dispositivos_estado;

CREATE VIEW public.v_dispositivos_estado AS
SELECT
  d.id,
  d.empresa_id,
  d.sucursal_id,
  d.nombre,
  d.api_key,
  d.activo,
  d.ip_local,
  d.hostname,
  d.heartbeat_at,
  d.version_app,
  d.config,
  d.creado_por,
  d.hwid,
  d.ultima_ip,
  d.empleados_count,
  d.ultimo_sync_at,
  d.encodings_version,
  d.camara_ok,
  d.health_score,
  d.updated_at,
  s.nombre AS sucursal_nombre,
  CASE
    WHEN d.heartbeat_at IS NULL THEN 'nunca'::text
    WHEN d.heartbeat_at > (now() - '00:02:00'::interval) THEN 'online'::text
    WHEN d.heartbeat_at > (now() - '00:10:00'::interval) THEN 'alerta'::text
    ELSE 'offline'::text
  END AS estado_conexion,
  EXTRACT(epoch FROM now() - d.heartbeat_at)::integer AS segundos_desde_heartbeat
FROM dispositivos d
LEFT JOIN sucursales s ON s.id = d.sucursal_id;

GRANT SELECT ON public.v_dispositivos_estado TO authenticated, anon, service_role;

COMMENT ON VIEW public.v_dispositivos_estado IS
  'Vista de dispositivos con estado calculado y todas las columnas raw. Usada por /dispositivos en el panel.';
