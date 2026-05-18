# Safe Link Web Panel

> Panel de administración SaaS para empresas cliente. Gestionan empleados, sucursales, dispositivos y consultan asistencias en tiempo real desde el navegador.
> Next.js 15 · TypeScript · Tailwind CSS · Supabase Auth + RLS

---

## Para qué sirve

Es la consola web que usa el administrador de cada empresa. Crea empleados con su foto, da de alta sucursales, registra dispositivos (estaciones físicas), y monitorea las asistencias en vivo. **Nunca toca SQL** — todo es UI.

| Pantalla | Qué hace |
|---|---|
| `/dashboard` | KPIs en tiempo real: empleados activos, dispositivos online, asistencias del día, gráficos |
| `/empleados` | CRUD de empleados con upload de foto a Supabase Storage; bulk import desde Excel |
| `/sucursales` | Crear/editar sucursales con horarios laborales |
| `/dispositivos` | Pareo de estaciones, monitoreo de heartbeats, comandos remotos (sync, restart) |
| `/asistencia` | Tabla con todas las marcaciones, filtros por empleado/fecha/sucursal |
| `/reportes` | Cálculos de horas trabajadas, retardos, ausencias; export a Excel |
| `/configuracion` | Datos de la empresa, plan SaaS, timezone |
| `/activar` | Onboarding zero-touch (crea empresa + admin + primera sucursal) |

---

## Requisitos

- **Node 20+**
- **npm 10+**
- Acceso al proyecto Supabase con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Instalación

```bash
# Desde la raíz del repo
cd web-panel

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con las credenciales de tu proyecto Supabase
```

### `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# Solo para rutas API privilegiadas (server-side)
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
│   │   ├── (auth)/login/         # Login Supabase Auth
│   │   ├── (dashboard)/          # Layout + páginas protegidas
│   │   │   ├── dashboard/
│   │   │   ├── empleados/
│   │   │   ├── sucursales/
│   │   │   ├── dispositivos/
│   │   │   ├── asistencia/
│   │   │   ├── reportes/
│   │   │   └── configuracion/
│   │   ├── activar/              # Onboarding zero-touch
│   │   ├── api/                  # Route handlers (server-side)
│   │   │   ├── empleados/
│   │   │   │   ├── create/route.ts
│   │   │   │   ├── update/route.ts
│   │   │   │   ├── delete/route.ts
│   │   │   │   └── bulk/route.ts
│   │   │   ├── sucursales/
│   │   │   ├── dispositivos/
│   │   │   ├── empresa/
│   │   │   └── onboarding/
│   │   ├── auth/                 # Callback OAuth
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/               # UI compartida
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts         # Cliente del browser (RLS aplicado)
│   │       └── server.ts         # Cliente SSR + service role
│   ├── types/
│   │   └── database.ts           # Tipos generados desde el schema
│   └── middleware.ts             # Protección de rutas
├── public/                       # Assets estáticos
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Modelo multi-tenant

Cada usuario que hace login pertenece a una `empresa_id` (claim en JWT). **Row Level Security (RLS)** filtra automáticamente todas las queries para que solo vean datos de su empresa:

```sql
-- Ejemplo: politica en tabla empleados
CREATE POLICY empleados_isolation ON empleados
  USING (empresa_id = auth_empresa_id());
```

`auth_empresa_id()` lee el claim `raw_user_meta_data.empresa_id` del JWT — ver `supabase/migrations/20260429_multitenant_saas_v1.sql`.

---

## Flujo end-to-end típico

```
Admin abre el panel
  └── Login (Supabase Auth)
      └── Middleware verifica sesion + empresa_id
          └── /empleados → crear empleado con foto
              └── POST /api/empleados/create
                  └── Insert en tabla empleados
                  └── Upload foto a fotos-empleados/<empresa_id>/<empleado_id>.jpg
                      └── Trigger Realtime → estacion descarga + entrena
                          └── Empleado puede usar la estacion
```

---

## Despliegue

### Vercel (producción y staging)

Hay 2 workflows automáticos:

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
   - Usuario admin con `empresa_id` en su JWT
   - Estación de prueba con QR de pareo
4. Recibe el QR para imprimir y pegarlo en la primera estación física
5. La estación lo escanea y queda activada

Todo el flujo está implementado en `supabase/migrations/20260508_provisioning_zero_touch.sql`.

---

## Decisiones de seguridad (ADR resumido)

Esta sección documenta decisiones explícitas de seguridad que pueden parecer "warnings sin arreglar" si solo se mira el linter de Supabase. Se mantienen así a propósito.

### Auditoría 2026-05-18 — hardening de RLS y performance

Se aplicaron las migraciones:

- `fase1_perf_security_quick_wins` — wrap de `auth.*()` en RLS, índices de FK, fijar `search_path` en 35 funciones SECURITY DEFINER, dedup de policies en `dispositivos`.
- `fase1b_remaining_perf_cleanups` — índices restantes y limpieza de policy redundante `pt_no_direct`.
- `fase2a_views_security_invoker` — las 3 views `v_asistencias_hoy`, `v_kpis_sucursal_30d`, `v_dispositivos_estado` ahora son `SECURITY INVOKER` (respetan RLS del consumidor).
- `fase2b_rls_hardening_app_metadata` — `auth_empresa_id()` lee de `app_metadata` (inmutable desde el cliente) con fallback a `user_metadata`. Policies de `audit_log` y `webhooks` usan el helper. `crear_empresa_onboarding` escribe `empresa_id` en ambos metadatas durante la transición.

Resultado: 9 ERRORS de security → 0. Performance findings: 47 → 12 (todos INFO sin impacto).

### Bucket `fotos-empleados` se mantiene público (con listing OFF)

Supabase advisor reporta WARN `public_bucket_allows_listing` sobre este bucket. **Decisión: mantenerlo público, desactivar el listing en el Dashboard.**

**Justificación:**
1. Las fotos no son contenido confidencial — son identificación visual operativa, visible para cualquier admin con acceso al panel.
2. Los paths usan UUIDs (`<empresa_id>/<empleado_id>.jpg`) no enumerables por fuerza bruta.
3. La RLS de `storage.objects` ya previene escritura/borrado cross-empresa.
4. Migrar a signed URLs costaría 3-4 h + coordinación de release con el binario `.exe` de las estaciones distribuidas en producción.
5. El costo no justifica el beneficio al volumen actual (1 empresa, ~10 empleados).

**Cuándo reconsiderar:**
- Al llegar a 10+ empresas activas, o
- Si agregamos contenido sensible al bucket (documentos, PDFs, datos personales), o
- Si compliance/cliente lo requiere explícitamente.

Cuando se migre, el plan es: `getPublicUrl()` → `createSignedUrl()` con TTL en panel; RPC `get_foto_signed_url(p_empleado_id)` para la estación; migrar paths existentes y actualizar `next.config.ts`.

### Migración pendiente: `user_metadata` → `app_metadata` en el frontend

El backend de RLS ya está endurecido (`auth_empresa_id()` ignora `user_metadata` si hay `app_metadata`). Sin embargo, el middleware (`src/middleware.ts`) y ~13 archivos del panel siguen leyendo `user.user_metadata?.empresa_id` para conveniencia. Esto **no es un riesgo de seguridad** (las queries van filtradas por RLS server-side), solo es deuda técnica.

`crear_empresa_onboarding` ya escribe en ambos metadatas para mantener compat. Cuando se migre el frontend a `user.app_metadata?.empresa_id`, se puede limpiar la copia duplicada en `user_metadata`.

### Cloudflare R2 considerado y descartado por ahora

A volumen actual (~2-5 GB/mes de egress), Supabase Storage está incluido en el plan Pro sin costo adicional. R2 tendría sentido cuando el egress supere los $50/mes de Supabase, o si se incorpora contenido pesado (video). Mientras tanto, R2 agregaría complejidad (firmar URLs manualmente, paths duplicados) sin beneficio económico.

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `Module not found: Can't resolve '@supabase/ssr'` | Falta `npm install` |
| Build de Next falla con `Cannot read properties of undefined (reading 'createClient')` | Falta env var `NEXT_PUBLIC_SUPABASE_URL` |
| Login OK pero `/dashboard` redirige a `/login` | El middleware no encuentra `empresa_id` en el JWT — el usuario no fue creado vía onboarding |
| Tabla de empleados vacía aunque existen en Supabase | RLS está bloqueando — verifica que el JWT del usuario tenga `empresa_id` en `app_metadata` o `user_metadata` (la función `auth_empresa_id()` acepta ambos) |
| `failed to fetch` en `/api/empleados/create` | Probablemente faltan permisos del service role o la RPC no existe en Supabase |

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
- [README general](../README.md)
- [README de la estación](../station/README.md)
