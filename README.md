# Safe Link Monitoring

Sistema SaaS B2B de control biométrico de asistencia empresarial.
Cada empresa instala estaciones físicas (PC con cámara) que reconocen empleados con IA facial.
El administrador gestiona todo desde un panel web sin necesidad de SQL ni configuración técnica.

---

## Arquitectura general

```
┌──────────────────────┐        ┌─────────────────────────┐        ┌──────────────────────┐
│     station/         │──────▶ │       Supabase           │ ◀──────│     web-panel/        │
│  App PyQt5           │  RPC   │  PostgreSQL + pgvector   │  SSR   │  Next.js 15 + Tailwind│
│  (on-premise, PC)    │  REST  │  Auth + RLS + Storage    │  API   │  (admin SaaS web)     │
└──────────────────────┘        └─────────────────────────┘        └──────────────────────┘
         ▲                                  │
         │ heartbeat cada 60s               │ funciones SECURITY DEFINER
         │ api_key en .env                  ▼
         └──────── estado online/offline visible en panel ────────────────────────────────▶
```

| Componente | Tecnología | Rol |
|---|---|---|
| `station/` | Python 3.10 · PyQt5 · OpenCV DNN | Cámara, IA facial YuNet+SFace, registro local |
| `supabase/` | PostgreSQL · pgvector · RLS · Auth | Backend multi-tenant en la nube |
| `web-panel/` | Next.js 15 · TypeScript · Tailwind CSS | Panel SaaS para empresas cliente |

---

## Modelo de datos (multi-tenant)

```
empresas  ──┬──▶  sucursales  ──▶  empleados  ──▶  asistencias
            └──▶  dispositivos (estaciones físicas)
```

Cada fila lleva `empresa_id`. RLS garantiza que un admin solo vea su propia empresa.
El campo `api_key` en `dispositivos` es un UUID v4 generado automáticamente que identifica cada estación.

### Tablas principales

| Tabla | Descripción |
|---|---|
| `empresas` | Tenant raíz. Un usuario admin pertenece a una empresa. |
| `sucursales` | Ubicaciones físicas de la empresa. |
| `empleados` | Personas registradas con embeddings faciales (pgvector 128D). |
| `dispositivos` | Estaciones físicas. Tienen `api_key`, `heartbeat_at`, `ip_local`, `hostname`. |
| `asistencias` | Registro de entrada/salida con `empleado_id`, `dispositivo_id`, timestamp. |

### Vista `v_dispositivos_estado`

Calcula el estado de conexión en tiempo real:

| Condición | Estado |
|---|---|
| `heartbeat_at` NULL | `nunca` |
| Hace ≤ 2 min | `online` |
| Hace ≤ 10 min | `alerta` |
| Hace > 10 min | `offline` |

### Funciones SECURITY DEFINER

Estas funciones bypasan RLS y se usan cuando el JWT del usuario aún no tiene `empresa_id` (onboarding / setup):

| Función | Descripción |
|---|---|
| `crear_empresa_onboarding(p_user_id, p_nombre, p_slug, p_timezone, p_sucursal, p_ciudad)` | Crea empresa + sucursal + asigna `empresa_id` al usuario en `raw_user_meta_data` |
| `crear_dispositivo(p_user_id, p_nombre, p_sucursal_id)` | Crea dispositivo para la empresa del usuario, retorna `api_key` |
| `station_heartbeat(p_api_key, p_ip_local, p_hostname, p_version)` | Actualiza `heartbeat_at`, `ip_local`, `hostname`, `version_app` del dispositivo |

---

## Flujo de vida de una estación

```
1. Admin abre el panel web (web-panel/)
   └──▶ /dispositivos → "Nueva estación" → llena nombre + sucursal
        └──▶ API /api/dispositivos/create → llama crear_dispositivo()
             └──▶ Supabase genera api_key UUID automáticamente
                  └──▶ Panel muestra: STATION_API_KEY=sk_xxxxxxxx

2. Admin copia la api_key al .env de la PC donde va la estación:
   STATION_API_KEY=sk_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

3. Admin ejecuta .\ejecutar.ps1 en esa PC
   └──▶ main.py lee STATION_API_KEY
        └──▶ station.validate() → True → lanza splash + login directamente
             └──▶ heartbeat cada 60s → panel muestra estación "online"

── ALTERNATIVA: Setup automático (sin api_key previa) ──────────────────

3b. Si .env no tiene STATION_API_KEY → aparece SetupWindow (wizard 3 pasos)
    Paso 1: Email + contraseña de admin
    Paso 2: Selecciona empresa, sucursal, nombre de la estación
    Paso 3: Llama crear_dispositivo() → guarda api_key en .env automáticamente
            → lanza la app principal sin reiniciar
```

---

## Panel web — páginas implementadas

| Ruta | Estado | Descripción |
|---|---|---|
| `/login` | ✅ | Auth con Supabase, cookies SSR, redirect post-login |
| `/onboarding` | ✅ | Wizard 4 pasos: crear empresa + sucursal para nuevos clientes |
| `/dashboard` | ✅ | Estadísticas del día, tabla de asistencias recientes |
| `/empleados` | ✅ | CRUD completo: crear, editar, eliminar empleados. Búsqueda en tiempo real. |
| `/asistencia` | ✅ | Historial de registros de asistencia |
| `/dispositivos` | ✅ | Estado online/offline **en tiempo real** (Supabase Realtime), crear/renombrar, ver API key |
| `/reportes` | 🔧 | Placeholder — gráficas pendientes |
| `/configuracion` | 🔧 | Placeholder — ajustes de empresa pendientes |

### API Routes

| Endpoint | Método | Función |
|---|---|---|
| `/api/onboarding` | POST | Crea empresa + sucursal vía `crear_empresa_onboarding()` |
| `/api/dispositivos/create` | POST | Crea dispositivo vía `crear_dispositivo()` |
| `/api/dispositivos/update` | POST | Renombra un dispositivo |
| `/api/empleados/create` | POST | Crea empleado en la empresa del usuario |
| `/api/empleados/update` | POST | Edita nombre, puesto, sucursal, activo de un empleado |
| `/api/empleados/delete` | POST | Elimina un empleado por ID |

---

## Estructura del repositorio

```
/
├── station/                        # App de escritorio (estación física)
│   ├── src/
│   │   ├── main.py                 # Entry point — decide setup vs app principal
│   │   ├── windows/
│   │   │   ├── login_window.py     # Login de empleados con reconocimiento facial
│   │   │   ├── splash_window.py    # Pantalla de carga con progreso
│   │   │   ├── setup_window.py     # Wizard primera configuración (crea dispositivo)
│   │   │   └── dashboard_window.py # Pantalla principal post-login
│   │   └── utils/
│   │       ├── supabase_client.py  # Singleton Supabase, carga .env por path absoluto
│   │       ├── station_manager.py  # Identidad (api_key) + heartbeat QThread cada 60s
│   │       ├── face_recognition.py # YuNet (detección) + SFace (embeddings 128D)
│   │       └── auth_manager.py     # Verificación de empleado contra pgvector
│   ├── models/                     # Modelos ONNX: face_detection_yunet, face_recognition_sface
│   ├── data/db/                    # SQLite local (buffer offline)
│   └── requirements.txt
│
├── web-panel/                      # Panel SaaS Next.js
│   ├── src/app/
│   │   ├── (auth)/
│   │   │   ├── login/              # Login SSR con @supabase/ssr 0.10.2
│   │   │   └── onboarding/         # Wizard nuevo cliente
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Layout con SidebarNav (Client Component)
│   │   │   ├── sidebar-nav.tsx     # Navegación lateral con usePathname()
│   │   │   ├── dashboard/
│   │   │   ├── empleados/
│   │   │   ├── asistencia/
│   │   │   ├── dispositivos/       # Lista + crear + renombrar + ver api_key + Realtime
│   │   │   │   ├── page.tsx        # Server Component (fetch inicial)
│   │   │   │   └── dispositivos-client.tsx  # Client Component + Supabase Realtime
│   │   │   ├── empleados/
│   │   │   │   ├── page.tsx        # Server Component (fetch empleados + sucursales)
│   │   │   │   └── empleados-client.tsx     # CRUD completo con modales
│   │   │   ├── reportes/
│   │   │   └── configuracion/
│   │   └── api/
│   │       ├── onboarding/
│   │       ├── sucursales/
│   │       ├── dispositivos/
│   │       │   ├── create/         # crear_dispositivo() SECURITY DEFINER
│   │       │   └── update/         # renombrar dispositivo
│   │       └── empleados/
│   │           ├── create/         # INSERT empleados con empresa_id del JWT
│   │           ├── update/         # UPDATE nombre, puesto, sucursal, activo
│   │           └── delete/         # DELETE por ID
│   ├── src/lib/supabase/
│   │   ├── client.ts               # createBrowserClient
│   │   └── server.ts               # createServerClient (cookies SSR)
│   └── src/middleware.ts           # Auth guard + redirect a onboarding si sin empresa
│
├── supabase/
│   └── migrations/
│       ├── 20260429_multitenant_saas_v1.sql    # Schema base: empresas, sucursales, empleados, dispositivos, asistencias
│       ├── 20260430_station_monitoring.sql      # heartbeat_at, hostname, v_dispositivos_estado, station_heartbeat()
│       ├── 20260430_onboarding_function.sql     # crear_empresa_onboarding()
│       └── 20260430_crear_dispositivo_fn.sql    # crear_dispositivo()
│
├── tools/                          # Scripts de administración offline
│   ├── enrollment/                 # Captura y entrenamiento de embeddings
│   ├── migration/                  # Migraciones manuales
│   ├── diagnostics/                # Verificación y limpieza
│   └── parsers/                    # Extracción de PDFs y Excel
│
├── .env                            # Variables de entorno (NO commitear)
├── ejecutar.ps1                    # Lanzar estación rápido (venv ya configurado)
└── iniciar.ps1                     # Setup completo + lanzar (primera vez)
```

---

## Variables de entorno (.env)

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGci...             # anon key pública

# IA (opcional — mejora precisión del reconocimiento)
GEMINI_API_KEY=AIzaSy...

# Identidad de esta estación física
# Generar desde panel web → Dispositivos → Nueva estación
STATION_API_KEY=sk_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

El panel web usa `web-panel/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Inicio rápido

### Estación (app de escritorio)

```powershell
# Primera vez — instala dependencias y configura venv
.\iniciar.ps1

# Veces siguientes
.\ejecutar.ps1
```

**Primera ejecución sin `STATION_API_KEY`:** aparece el wizard de configuración.
Ingresa credenciales de admin, selecciona empresa y sucursal, nombra la estación.
La API key se guarda automáticamente en `.env` y la app arranca sola.

**Con `STATION_API_KEY` en `.env`:** arranca directo al splash + login.

### Panel web (desarrollo local)

```bash
cd web-panel
cp .env.local.example .env.local   # o crea .env.local con las keys de Supabase
npm install
npm run dev
# Abre http://localhost:3000
```

### Aplicar migraciones a Supabase

En Supabase Dashboard → SQL Editor, ejecutar en orden:

```
supabase/migrations/20260429_multitenant_saas_v1.sql
supabase/migrations/20260430_station_monitoring.sql
supabase/migrations/20260430_onboarding_function.sql
supabase/migrations/20260430_crear_dispositivo_fn.sql
```

---

## Planes del producto

| Plan | Estaciones | Empleados | Funciones |
|---|---|---|---|
| Starter | 1 | hasta 50 | Asistencia básica |
| Business | 5 | hasta 500 | Multi-sucursal, reportes |
| Enterprise | ilimitado | ilimitado | API pública, integraciones RH, SLA |

---

## Estado actual del desarrollo

### Completado ✅

**Infraestructura y backend**
- Schema multi-tenant en Supabase con RLS y pgvector
- Auth SSR con `@supabase/ssr` 0.10.2 (login, cookies, middleware, redirect)
- Onboarding wizard para nuevos clientes (crea empresa + sucursal sin SQL)
- Funciones SECURITY DEFINER que bypasan RLS para onboarding y setup
- Vista `v_dispositivos_estado` con cálculo de estado automático (online/alerta/offline/nunca)
- Heartbeat de estación cada 60s (QThread background, RPC `station_heartbeat`)

**Panel web (web-panel/)**
- Sidebar con navegación activa (`usePathname`), todas las páginas accesibles
- Panel de dispositivos: crear, renombrar, ver/copiar API key
- **Dispositivos en tiempo real:** Supabase Realtime subscription — el estado online/offline se actualiza solo sin recargar (indicador verde pulsante "Tiempo real")
- **CRUD completo de empleados:** crear, editar (nombre, puesto, sucursal, activo), eliminar con confirmación, búsqueda instantánea por nombre/apellido/código

**App de escritorio (station/)**
- SetupWindow: wizard automático que crea dispositivo y escribe `STATION_API_KEY` en `.env`
- SplashScreen rediseñada — `QWidget` frameless + `QWebEngineView`, barra de progreso animada, auto-avance hasta 75%, fade-out al terminar
- LoginWindow rediseñada — CSS glassmorphism, layout dos paneles (cámara | formulario), QWebChannel Python↔JS
- DashboardWindow rediseñada — topbar minimalista, sección de cámara con HUD corners + scan line, sidebar con arco de confianza SVG animado, overlay de asistencia registrada
- Design system OLED dark consistente: `#050810` bg, `#3B82F6` accent, `#22C55E` green, Fira Code para datos

### Pendiente 🔧

**Alta prioridad**
- **Enrollment en estación:** flujo completo de captura guiada de fotos → embedding pgvector → subida a Supabase. Actualmente el botón "Registrar empleado" no hace nada.
- **Reportes con gráficas:** `/reportes` es placeholder — necesita gráficas de asistencia por día/semana (Recharts o Chart.js), top empleados, resumen mensual.

**Media prioridad**
- **Configuración de empresa:** `/configuracion` es placeholder — editar nombre, timezone, logo, sucursales.
- **Notificaciones:** alertas en el panel cuando una estación pasa a offline, llegadas tarde, ausencias del día.
- **Historial de asistencias mejorado:** filtros por empleado, sucursal, rango de fechas, exportar a CSV/Excel.

**Baja prioridad / futuro**
- **Electron / PyInstaller:** empaquetar la app PyQt5 como instalador `.exe` descargable desde el panel (PyInstaller + NSIS, investigado y viable).
- **Billing con Stripe:** planes Starter / Business / Enterprise con límites de estaciones y empleados por tenant.
- **API pública REST:** endpoints para integración con sistemas externos de RH (Personio, BambooHR, SAP).
- **App móvil:** consulta de asistencia y aprobaciones desde celular (React Native o PWA).

---

## Notas técnicas importantes

**¿Por qué SECURITY DEFINER en vez de RLS directo?**
Al crear una empresa nueva, el JWT del usuario no tiene `empresa_id` aún (se asigna durante el onboarding). RLS bloquearía el INSERT. Las funciones SECURITY DEFINER corren como el owner del schema y leen `raw_user_meta_data` de `auth.users` directamente.

**¿Por qué `router.refresh()` + `router.push()` en el login?**
`@supabase/ssr` requiere que las cookies de sesión se propaguen al Server Component antes del redirect. `window.location.replace()` no lo hace correctamente. `router.refresh()` fuerza el re-fetch del Server Component con las cookies nuevas.

**¿Por qué `(supabase as any)` en algunas queries?**
El cliente Supabase no puede inferir el tipo de retorno de JOINs complejos ni de vistas custom (`v_dispositivos_estado`). Se castea a `any` para esas queries y se usan tipos TypeScript explícitos locales.
