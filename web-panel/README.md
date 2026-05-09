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

## Troubleshooting

| Problema | Solución |
|---|---|
| `Module not found: Can't resolve '@supabase/ssr'` | Falta `npm install` |
| Build de Next falla con `Cannot read properties of undefined (reading 'createClient')` | Falta env var `NEXT_PUBLIC_SUPABASE_URL` |
| Login OK pero `/dashboard` redirige a `/login` | El middleware no encuentra `empresa_id` en el JWT — el usuario no fue creado vía onboarding |
| Tabla de empleados vacía aunque existen en Supabase | RLS está bloqueando — verifica que el JWT del usuario tenga `empresa_id` en `raw_user_meta_data` |
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
