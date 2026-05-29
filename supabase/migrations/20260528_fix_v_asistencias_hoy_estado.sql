-- Fix v_asistencias_hoy — dos correcciones:
--
-- 1) ESTADO POR ÚLTIMO EVENTO
--    Antes marcaba 'salio' si existia CUALQUIER salida en el dia, ignorando
--    entradas posteriores (ej. regreso de comer). Ahora decide por el ultimo
--    evento real: si la ultima entrada es posterior a la ultima salida ->
--    'presente'.
--
-- 2) TIMEZONE DEL FILTRO "HOY"
--    El filtro usaba timestamp::date = CURRENT_DATE en UTC. Una entrada de las
--    8 PM hora de Mexico cae en el dia siguiente en UTC, asi que aparecia en
--    el dashboard del dia equivocado (y contaba a alguien de ayer como
--    presente hoy). Ahora convertimos a America/Mexico_City antes de comparar.

CREATE OR REPLACE VIEW public.v_asistencias_hoy AS
SELECT e.empresa_id,
    e.id AS empleado_id,
    (e.nombre || ' '::text) || e.apellido AS nombre_completo,
    s.nombre AS sucursal,
    max(r."timestamp") FILTER (WHERE r.tipo = 'entrada'::text) AS ultima_entrada,
    max(r."timestamp") FILTER (WHERE r.tipo = 'salida'::text) AS ultima_salida,
    CASE
        WHEN max(r."timestamp") FILTER (WHERE r.tipo = 'entrada'::text) IS NULL THEN 'ausente'::text
        WHEN max(r."timestamp") FILTER (WHERE r.tipo = 'salida'::text) IS NULL THEN 'presente'::text
        WHEN max(r."timestamp") FILTER (WHERE r.tipo = 'entrada'::text) > max(r."timestamp") FILTER (WHERE r.tipo = 'salida'::text) THEN 'presente'::text
        ELSE 'salio'::text
    END AS estado
   FROM empleados e
     LEFT JOIN sucursales s ON s.id = e.sucursal_id
     LEFT JOIN registros_asistencia r ON r.empleado_id = e.id
        AND (r."timestamp" AT TIME ZONE 'America/Mexico_City')::date
            = (now() AT TIME ZONE 'America/Mexico_City')::date
  WHERE e.activo = true
  GROUP BY e.empresa_id, e.id, e.nombre, e.apellido, s.nombre;
