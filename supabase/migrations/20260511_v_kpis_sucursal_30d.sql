-- S2.4: vista con KPIs por sucursal en los ultimos 30 dias.
-- Permite dashboard ejecutivo comparar sucursales (puntualidad,
-- volumen, ausentismo, marcaciones manuales).

create or replace view public.v_kpis_sucursal_30d as
with rango as (
  select (now() - interval '30 days')::timestamptz as desde,
         now()::timestamptz                        as hasta
),
registros as (
  select
    r.empresa_id,
    r.sucursal_id,
    r.empleado_id,
    r.tipo,
    r.timestamp,
    r.creado_manual,
    (r.timestamp at time zone coalesce(e.timezone, 'America/Mexico_City'))::date as fecha_local,
    extract(hour from (r.timestamp at time zone coalesce(e.timezone, 'America/Mexico_City'))) as hora_local
  from public.registros_asistencia r
  join public.empresas e on e.id = r.empresa_id
  join rango on r.timestamp >= rango.desde and r.timestamp <= rango.hasta
),
agg as (
  select
    empresa_id,
    sucursal_id,
    count(*) filter (where tipo = 'entrada') as total_entradas,
    count(*) filter (where tipo = 'salida')  as total_salidas,
    count(*) filter (where creado_manual)    as marcaciones_manuales,
    count(distinct empleado_id)              as empleados_activos,
    count(distinct fecha_local)              as dias_con_actividad,
    count(*) filter (where tipo = 'entrada' and hora_local < 9)::float
      / nullif(count(*) filter (where tipo = 'entrada'), 0)::float as ratio_puntualidad,
    avg(hora_local) filter (where tipo = 'entrada') as hora_promedio_entrada
  from registros
  group by empresa_id, sucursal_id
)
select
  s.id              as sucursal_id,
  s.empresa_id,
  s.nombre          as sucursal_nombre,
  s.zona,
  s.ciudad,
  s.activa,
  coalesce(a.total_entradas, 0)        as total_entradas,
  coalesce(a.total_salidas, 0)         as total_salidas,
  coalesce(a.marcaciones_manuales, 0)  as marcaciones_manuales,
  coalesce(a.empleados_activos, 0)     as empleados_activos,
  coalesce(a.dias_con_actividad, 0)    as dias_con_actividad,
  coalesce(a.ratio_puntualidad, 0)     as ratio_puntualidad,
  a.hora_promedio_entrada
from public.sucursales s
left join agg a on a.sucursal_id = s.id and a.empresa_id = s.empresa_id;

grant select on public.v_kpis_sucursal_30d to authenticated;

comment on view public.v_kpis_sucursal_30d is
  'KPIs por sucursal en los ultimos 30 dias. Para /dashboard/ejecutivo.';
