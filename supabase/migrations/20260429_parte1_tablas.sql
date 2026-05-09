-- PARTE 1: Tablas y Vista (ejecutar primero)

create extension if not exists vector;

create table if not exists empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  slug            text not null unique,
  plan            text not null default 'starter' check (plan in ('starter', 'business', 'enterprise')),
  activa          boolean not null default true,
  creada_en       timestamptz not null default now(),
  max_empleados   int not null default 50,
  max_estaciones  int not null default 1,
  logo_url        text,
  timezone        text not null default 'America/Mexico_City'
);

create table if not exists sucursales (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  zona        text,
  ciudad      text,
  direccion   text,
  activa      boolean not null default true
);

create table if not exists empleados (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  sucursal_id     uuid references sucursales(id) on delete set null,
  nombre          text not null,
  apellido        text not null,
  employee_code   text,
  puesto          text,
  departamento    text,
  nivel_acceso    int not null default 1 check (nivel_acceso between 1 and 5),
  activo          boolean not null default true,
  foto_url        text,
  enrollado       boolean not null default false,
  creado_en       timestamptz not null default now(),
  unique (empresa_id, employee_code)
);

create table if not exists embeddings_faciales (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references empleados(id) on delete cascade,
  empresa_id      uuid not null references empresas(id) on delete cascade,
  embedding       vector(128) not null,
  modelo_version  text not null default 'sface_v3',
  es_augmentado   boolean not null default false,
  creado_en       timestamptz not null default now()
);

create table if not exists dispositivos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  sucursal_id       uuid references sucursales(id) on delete set null,
  nombre            text not null,
  api_key           text not null unique default gen_random_uuid()::text,
  activo            boolean not null default true,
  ultima_conexion   timestamptz,
  version_app       text,
  ip_local          text,
  notas             text
);

create table if not exists registros_asistencia (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references empresas(id) on delete cascade,
  empleado_id           uuid not null references empleados(id) on delete cascade,
  dispositivo_id        uuid references dispositivos(id) on delete set null,
  sucursal_id           uuid references sucursales(id) on delete set null,
  tipo                  text not null check (tipo in ('entrada', 'salida')),
  timestamp             timestamptz not null default now(),
  confianza             float check (confianza between 0 and 1),
  reconocimiento_facial boolean not null default true,
  sincronizado          boolean not null default true,
  notas                 text
);

create or replace view v_asistencias_hoy as
select
  e.empresa_id,
  e.id                                               as empleado_id,
  e.nombre || ' ' || e.apellido                      as nombre_completo,
  s.nombre                                           as sucursal,
  max(r.timestamp) filter (where r.tipo = 'entrada') as ultima_entrada,
  max(r.timestamp) filter (where r.tipo = 'salida')  as ultima_salida,
  case
    when max(r.timestamp) filter (where r.tipo = 'salida')  is not null then 'salio'
    when max(r.timestamp) filter (where r.tipo = 'entrada') is not null then 'presente'
    else 'ausente'
  end as estado
from empleados e
left join sucursales s on s.id = e.sucursal_id
left join registros_asistencia r
       on r.empleado_id = e.id
      and r.timestamp::date = current_date
where e.activo = true
group by e.empresa_id, e.id, e.nombre, e.apellido, s.nombre;

create or replace function buscar_empleado_por_embedding(
  p_empresa_id  uuid,
  p_embedding   vector(128),
  p_threshold   float default 0.40,
  p_limit       int   default 5
)
returns table (
  empleado_id  uuid,
  nombre       text,
  apellido     text,
  sucursal     text,
  similitud    float
)
language sql stable
as $$
  select
    e.id,
    e.nombre,
    e.apellido,
    s.nombre as sucursal,
    1 - (ef.embedding <=> p_embedding) as similitud
  from embeddings_faciales ef
  join empleados e on e.id = ef.empleado_id
  left join sucursales s on s.id = e.sucursal_id
  where ef.empresa_id = p_empresa_id
    and e.activo = true
    and 1 - (ef.embedding <=> p_embedding) >= p_threshold
  order by ef.embedding <=> p_embedding
  limit p_limit;
$$;
