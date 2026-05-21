# Safe Link Web Panel

> Panel de administración SaaS para empresas cliente. Gestionan empleados, sucursales,
> estaciones físicas y monitorean asistencias en tiempo real desde el navegador.
>
> **Stack**: Next.js 15 · React 18 · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + RLS + Realtime) · Leaflet

---

## ¿Qué hace?

Es la consola que usa el administrador de cada empresa. Crea empleados con su foto, registra
sucursales (con ubicación geográfica), enlaza estaciones físicas, y monitorea todo en vivo.
**Nunca toca SQL** — todo es UI.

### Mapa de páginas

| Página | Ruta | Qué hace |
|---|---|---|
| **Tablero** | `/tablero` | "Wall" en vivo de las estaciones — tiles con border-glow por estado, marcaciones recientes |
| **Mapa** | `/mapa` | Vista geográfica de sucursales con Leaflet · pines color por % online · filtros · leyenda |
| **Dashboard** | `/dashboard` | KPIs del día: presentes / ausentes / salieron / asistencia % |
| **Asistencia** | `/asistencia` | Tabla con todas las marcaciones, filtros por empleado/fecha/sucursal |
| **Empleados** | `/empleados` | CRUD con upload de foto a Supabase Storage + import masivo desde Excel |
| **Sucursales** | `/sucursales` | CRUD con horarios laborales + **tab Ubicación** con click-to-place en mapa |
| **Estaciones** | `/dispositivos` | Pareo de estaciones, heartbeats, comandos remotos (sync, restart, clear cache) |
| **Reportes** | `/reportes` | Horas trabajadas, retardos, ausencias; export a Excel |
| **Ejecutivo** | `/ejecutivo` | Vista resumida para gerentes (KPIs ejecutivos) |
| **Actividad** | `/actividad` | Audit log de acciones admin |
| **Notificaciones** | `/notificaciones` | Histórico de eventos (estaciones offline, llegadas tarde, etc.) |
| **Configuración** | `/configuracion` | Datos de la empresa, plan SaaS, timezone |
| **Activar** | `/activar` | Onboarding zero-touch (crea empresa + admin + primera sucursal) |

---

## Sistema de diseño (identidad Safe Link)

### Tipografía

| Familia | Uso | Variable CSS |
|---|---|---|
| **Geist Sans** | Titulares (h1/h2), tabs del topbar, brand, section labels | `--font-heading` |
| **Inter** | Cuerpo, UI general | `--font-body` |
| **JetBrains Mono** | Datos tabulares (coordenadas, API keys, IPs, IDs, timestamps) | `--font-data` |

Autohosteadas por `next/font` (cero CLS, zero CSS extra). Define el sistema completo en `globals.css`:

```css
.heading-1     { font-family: var(--font-heading); font-weight: 600; letter-spacing: -0.035em; }
.font-mono     { font-family: var(--font-data); font-feature-settings: "tnum", "ss01"; }
```

### Paleta

```css
--accent      #2563eb    /* Azul primario — acciones, estado activo */
--teal        #14b8a6    /* Secundario — "tiempo real / datos / heartbeat" */
--green       #22c55e    /* Status online / presente */
--yellow      #eab308    /* Status warn / alerta */
--red         #ef4444    /* Status error / offline */
```

Teal es lo que diferencia Safe Link de un dashboard B2B genérico. Aparece en:
- `<StatusBadge kind="live">` con halo cyan pulsando
- Brand tagline `MONITORING`
- Underline gradient `azul→teal` del tab activo en topbar
- Hover de metric chips
- Counter overlay y leyenda del mapa

### Componentes clave

| Componente | Archivo | Para qué |
|---|---|---|
| `<PageHeader>` | `components/ui/PageHeader.tsx` | Hero unificado con `title · count` pattern |
| `<StatusBadge>` | `components/ui/StatusBadge.tsx` | Dot + label con 6 kinds (`online`/`warn`/`offline`/`error`/`neutral`/`live`) |
| `<StatCard>` | `components/ui/StatCard.tsx` | Métricas con icon, value, delta, sparkline opcional |
| `<EmptyState>` | `components/ui/EmptyState.tsx` | Estado vacío con icon, mensaje, CTA |
| `<LocationPicker>` | `components/ui/LocationPicker.tsx` | Mini-mapa Leaflet con click-to-place + geolocation API |

### Shell de la aplicación

```
┌──────────────────┬─────────────────────────────────────────────┐
│ Safe Link        │  Tablero · Mapa · Dashboard · Asistencia  🔍│
│ MONITORING       ├─────────────────────────────────────────────┤
│                  │                                              │
│ EMPRESA          │                                              │
│ ┌─ Demo ▾─────┐  │                                              │
│ └─────────────┘  │       (contenido de la página actual)        │
│                  │                                              │
│ OPERACIÓN        │                                              │
│  • Inicio        │                                              │
│  • Empleados     │                                              │
│  • Sucursales    │                                              │
│  • Estaciones    │                                              │
│                  │                                              │
│ ANÁLISIS         │                                              │
│  • Reportes      │                                              │
│  ...             │                                              │
└──────────────────┴─────────────────────────────────────────────┘
```

- **Sidebar** = recursos/catálogo (no duplica las vistas del topbar)
- **TopBar** = tabs contextuales de la sección actual + búsqueda Cmd+K + bell con badge real + avatar
- **OrgSwitcher** arriba del sidebar muestra la empresa actual (feel multi-tenant)

### Animaciones pro (curated, no decorativas)

| Animación | Cuándo aparece | Duración |
|---|---|---|
| `live-pulse` | Dots de `StatusBadge` con `strong=true` (En vivo) | 2.4s loop |
| `tile-accent-breathe` | Línea acento superior de tiles online | 4s loop |
| `tab-underline-in` | Subrayado del tab activo al cambiar de sección | 240ms cubic-bezier |
| `sl-pin-halo` | Halo de pines del mapa para sucursales online o seleccionadas | 2.4s loop |
| `bio-line-flow` (login antiguo) | Eliminado en favor del rediseño editorial | — |

---

## Requisitos

- **Node 20+**
- **npm 10+**
- Proyecto Supabase con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Para el mapa: tiles de CartoDB Dark — no requiere API key, no requiere cuenta

---

## Instalación

```bash
# Desde la raíz del repo
cd web-panel

# Dependencias
npm install

# Variables de entorno
cp .env.local.example .env.local
# Edita .env.local con las credenciales de tu proyecto Supabase
```

### `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Server-side only — NUNCA con prefijo NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

> ⚠️ **Nunca** uses `SUPABASE_SERVICE_ROLE_KEY` con prefijo `NEXT_PUBLIC_` — eso lo expone al cliente.

---

## Uso

### Desarrollo local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Build de producción

```bash
npm run build
npm run start
```

### Validaciones

```bash
npm run type-check    # tsc --noEmit
npm run lint          # next lint
```

---

## Estructura

```
web-panel/
├── src/
│   ├── app/
│   │   ├── (auth)/login/             # Login editorial con hero gradient + form pro
│   │   ├── (dashboard)/              # Layout + páginas protegidas
│   │   │   ├── layout.tsx            # Shell (Sidebar + TopBar + main)
│   │   │   ├── sidebar-nav.tsx       # Sidebar con OrgSwitcher + 3 grupos
│   │   │   ├── topbar.tsx            # Tabs contextuales + bell + search + avatar
│   │   │   ├── dashboard/            # KPIs del día
│   │   │   ├── tablero/              # Wall de estaciones estilo monitoring
│   │   │   ├── mapa/                 # Leaflet con pines custom + overlays
│   │   │   │   ├── page.tsx
│   │   │   │   ├── mapa-client.tsx   # Toolbar, sidebar, leyenda
│   │   │   │   └── MapView.tsx       # Leaflet vanilla (no react-leaflet)
│   │   │   ├── empleados/
│   │   │   ├── sucursales/           # Con tab Ubicación + LocationPicker
│   │   │   ├── dispositivos/         # Tiles .estacion-tile con border-glow
│   │   │   ├── asistencia/
│   │   │   ├── reportes/
│   │   │   ├── ejecutivo/
│   │   │   ├── actividad/
│   │   │   ├── notificaciones/
│   │   │   └── configuracion/
│   │   ├── activar/                  # Onboarding zero-touch
│   │   ├── api/                      # Route handlers (server-side)
│   │   │   ├── empleados/{create,update,delete,bulk}/
│   │   │   ├── sucursales/{create,update,delete}/  # lat/lng validados
│   │   │   ├── dispositivos/
│   │   │   ├── empresa/
│   │   │   └── onboarding/
│   │   ├── globals.css               # Sistema de diseño completo
│   │   └── layout.tsx                # Root: Geist + Inter + JBMono via next/font
│   ├── components/
│   │   ├── ui/
│   │   │   ├── PageHeader.tsx        # Hero con title · count
│   │   │   ├── StatusBadge.tsx       # Dot + label, 6 kinds
│   │   │   ├── StatCard.tsx          # Métricas con sparkline
│   │   │   ├── EmptyState.tsx
│   │   │   └── LocationPicker.tsx    # Leaflet vanilla + geolocation
│   │   ├── notifications/
│   │   │   ├── NotificationProvider.tsx
│   │   │   └── PanelNotificationsWatcher.tsx  # Silencioso en primer mount
│   │   └── command/                  # CommandPalette (Cmd+K)
│   ├── lib/
│   │   └── supabase/{client,server}.ts
│   ├── types/
│   │   └── database.ts               # Tipos generados desde el schema
│   └── middleware.ts                 # Protección de rutas
├── public/
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Modelo multi-tenant

Cada usuario que hace login pertenece a una `empresa_id` (claim en JWT). **Row Level Security (RLS)**
filtra automáticamente todas las queries para que solo vean datos de su empresa:

```sql
-- Politica en cada tabla multi-tenant
CREATE POLICY empleados_isolation ON empleados
  USING (empresa_id = auth_empresa_id());

-- auth_empresa_id() lee app_metadata (inmutable desde cliente) con fallback a user_metadata
CREATE FUNCTION auth_empresa_id() RETURNS uuid
  SECURITY DEFINER LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    ((auth.jwt() -> 'app_metadata')     ->> 'empresa_id')::uuid,
    ((auth.jwt() -> 'user_metadata')    ->> 'empresa_id')::uuid
  );
$$;
```

Ver `supabase/migrations/20260429_multitenant_saas_v1.sql` y el hardening de seguridad en la
sección "Decisiones de seguridad" más abajo.

---

## Flujo end-to-end típico

```
Admin abre el panel
  └── Login (Supabase Auth)
      └── Middleware verifica sesión + empresa_id
          └── /tablero → ve sus estaciones en vivo
          └── /empleados → crear empleado con foto
              └── POST /api/empleados/create
                  └── Insert en tabla empleados
                  └── Upload foto a fotos-empleados/<empresa_id>/<empleado_id>.jpg
                      └── Trigger Realtime → estación descarga + entrena
                          └── Empleado puede usar la estación
```

---

## Mapa de sucursales

### Cómo funciona

- **Leaflet vanilla** (no `react-leaflet`) para evitar el bug "Map container is already initialized" en React 18 Strict Mode
- **Tiles**: CartoDB Dark (sin API key, sin cuenta, sin costo)
- **Pines custom**: anillo + núcleo con color por % estaciones online (verde ≥80% / ámbar 40-80% / rojo <40% / gris sin estaciones)
- **Halo animado**: sucursales online o seleccionadas tienen pulso cyan expandiéndose
- **Counter badge** en pin si la sucursal tiene más de 1 estación

### Geolocalización

Al editar una sucursal, el tab **Ubicación** abre un mini-mapa con:
- Botón **"Mi ubicación"** que usa `navigator.geolocation.getCurrentPosition()` con `enableHighAccuracy`
- Indicador del radio de precisión real (`accuracy` en metros)
- **Click** en el mapa coloca pin nuevo · **Drag** lo afina · **"Quitar"** lo borra
- Coordenadas en formato `19.43260°, -99.13320°` con tipografía monoespaciada

### Filtros y overlays

- **Segmented toolbar** arriba: `Todas · Online · Alerta · Offline` con conteos
- **Counter overlay** top-right del mapa: `N en mapa` con dot teal pulsando
- **Leyenda** bottom-left con glass `backdrop-filter: blur(10px)`
- **Botón "Ver todas"** → `flyToBounds` con animación

---

## Sistema de notificaciones

### Reglas de UX

1. **Silenciosa en el primer mount** — al cargar el panel NO toastea, solo persiste a `notificaciones`.
   El badge del bell muestra el count real (ej. `87`). Razón: evitar el muro de toasts apilados con
   estaciones que ya estaban offline cuando entraste.
2. **Solo eventos nuevos** disparan toasts efímeros (chequeo cada 60s).
3. **Toasts compactas** en top-right bajo el topbar (no en bottom-right que tapa el sidebar derecho del Tablero).
4. **Máximo 3 visibles** + chip `+N más · Limpiar`.

### Eventos detectados (`PanelNotificationsWatcher`)

| Evento | Trigger | Severidad |
|---|---|---|
| `station_offline` | Heartbeat > 5 min | `warn` / `critical` si >30 min |
| `station_recovered` | Vuelve online tras offline | `info` |
| `station_camera_error` | `camara_ok = false` | `error` |
| `station_health_low` | `health_score < 50` | `warn` |
| `employee_late_arrival` | Entrada > apertura + tolerancia | `warn` / `error` si >30 min |

---

## Despliegue

### Vercel (producción y staging)

Dos workflows automáticos:

| Workflow | Trigger | Deploy |
|---|---|---|
| `vercel-staging.yml` | Push a `develop` o PR a `main` | Preview deployment |
| `vercel-production.yml` | Push a `main` | Production |

**Secrets requeridos en GitHub:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Self-hosted

```bash
npm run build
PORT=3000 npm start
```

O con Docker:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

---

## Onboarding de una empresa nueva (zero-touch)

1. El cliente recibe un link único: `https://panel.safelink.app/activar?token=<onboarding_token>`
2. Llena: nombre empresa, email admin, password, primera sucursal
3. La ruta API `/api/onboarding` crea en una sola transacción:
   - Empresa
   - Sucursal inicial
   - Usuario admin con `empresa_id` en JWT (app_metadata + user_metadata)
   - Estación de prueba con QR de pareo
4. Recibe el QR para imprimir y pegarlo en la primera estación física
5. La estación lo escanea y queda activada

Implementado en `supabase/migrations/20260508_provisioning_zero_touch.sql`.

---

## Decisiones de seguridad (ADR resumido)

Esta sección documenta decisiones explícitas que pueden parecer "warnings sin arreglar" si solo se
mira el linter de Supabase. Se mantienen así a propósito.

### Auditoría 2026-05-18 — hardening de RLS y performance

Migraciones aplicadas:

- `fase1_perf_security_quick_wins` — wrap de `auth.*()` en RLS, índices de FK, fijar `search_path`
  en 35 funciones SECURITY DEFINER, dedup de policies en `dispositivos`.
- `fase1b_remaining_perf_cleanups` — índices restantes y limpieza de policy redundante `pt_no_direct`.
- `fase2a_views_security_invoker` — `v_asistencias_hoy`, `v_kpis_sucursal_30d`, `v_dispositivos_estado`
  son ahora `SECURITY INVOKER` (respetan RLS del consumidor).
- `fase2b_rls_hardening_app_metadata` — `auth_empresa_id()` lee de `app_metadata` (inmutable desde
  cliente) con fallback a `user_metadata`. Policies de `audit_log` y `webhooks` usan el helper.
  `crear_empresa_onboarding` escribe `empresa_id` en ambos metadatas durante la transición.

Resultado: 9 ERRORS de security → 0. Performance findings: 47 → 12 (todos INFO sin impacto).

### Bucket `fotos-empleados` se mantiene público (con listing OFF)

Decisión: mantenerlo público, desactivar el listing en el Dashboard.

**Justificación:**
1. Las fotos no son contenido confidencial — son identificación visual operativa, visible para
   cualquier admin con acceso al panel.
2. Los paths usan UUIDs (`<empresa_id>/<empleado_id>.jpg`) no enumerables por fuerza bruta.
3. La RLS de `storage.objects` ya previene escritura/borrado cross-empresa.
4. Migrar a signed URLs costaría 3-4 h + coordinación de release con el binario `.exe` de las
   estaciones distribuidas en producción.
5. El costo no justifica el beneficio al volumen actual.

**Cuándo reconsiderar:** al llegar a 10+ empresas activas, o si agregamos contenido sensible
al bucket (documentos, PDFs, datos personales), o si compliance/cliente lo requiere explícitamente.

### Cloudflare R2 considerado y descartado por ahora

A volumen actual (~2-5 GB/mes de egress), Supabase Storage está incluido en el plan Pro sin costo.
R2 tendría sentido cuando el egress supere los $50/mes de Supabase, o si se incorpora contenido
pesado (video). Mientras tanto, R2 agregaría complejidad (firmar URLs manualmente, paths duplicados)
sin beneficio económico.

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `Module not found: Can't resolve '@supabase/ssr'` | Falta `npm install` |
| Build de Next falla con `Cannot read properties of undefined (reading 'createClient')` | Falta env var `NEXT_PUBLIC_SUPABASE_URL` |
| Login OK pero `/dashboard` redirige a `/login` | El middleware no encuentra `empresa_id` en el JWT — el usuario no fue creado vía onboarding |
| Tabla de empleados vacía aunque existen en Supabase | RLS está bloqueando — verifica que el JWT del usuario tenga `empresa_id` en `app_metadata` o `user_metadata` |
| `failed to fetch` en `/api/empleados/create` | Probablemente faltan permisos del service role o la RPC no existe en Supabase |
| `Map container is already initialized` | Está corregido — uses Leaflet vanilla, no react-leaflet. Si reaparece, limpia `_leaflet_id` del div container |
| Pines del mapa no aparecen | Las sucursales no tienen `lat/lng` — edita en `/sucursales` → tab Ubicación |
| Fuentes Geist no cargan | Verifica `geist` instalado: `npm install geist` |

---

## Comandos útiles

```bash
npm run dev              # Dev server con hot reload
npm run build            # Build de producción
npm run start            # Servir build
npm run type-check       # tsc --noEmit
npm run lint             # ESLint
```

---

## Recursos relacionados

- [Runbook del panel (`docs/runbook-panel.md`)](../docs/runbook-panel.md)
- [Arquitectura general (`docs/arquitectura.md`)](../docs/arquitectura.md)
- [Manual de instalación de la estación (`docs/MANUAL_INSTALACION.md`)](../docs/MANUAL_INSTALACION.md)
- [README general](../README.md)
- [README de la estación](../station/README.md)
