# Safe Link Monitoring

[![Última versión](https://img.shields.io/github/v/release/Safe-LM/app-login-trabajadores-desktop?label=Última%20versión&color=2563eb&style=flat-square)](https://github.com/Safe-LM/app-login-trabajadores-desktop/releases/latest)
[![Descargas](https://img.shields.io/github/downloads/Safe-LM/app-login-trabajadores-desktop/total?label=Descargas&color=22c55e&style=flat-square)](https://github.com/Safe-LM/app-login-trabajadores-desktop/releases)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow?style=flat-square)](https://conventionalcommits.org)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#)

Sistema SaaS B2B de control biométrico de asistencia empresarial.
Cada empresa instala estaciones físicas (PC con cámara) que reconocen empleados con IA facial.
El administrador gestiona todo desde un panel web sin necesidad de SQL ni configuración técnica.

---

## 📥 Descargas

### Última versión estable

> 🚀 [**Descargar el instalador para Windows →**](https://github.com/Safe-LM/app-login-trabajadores-desktop/releases/latest)

| Plataforma | Requisitos |
|---|---|
| 🪟 Windows 10/11 (x64) | Cámara USB/integrada, internet, 280 MB libres |

📖 **Manual de instalación paso a paso**: [`docs/MANUAL_INSTALACION.md`](docs/MANUAL_INSTALACION.md) (~3 minutos)

### Versiones anteriores

[Ver todas las versiones](https://github.com/Safe-LM/app-login-trabajadores-desktop/releases)
· [Changelog histórico](CHANGELOG.md)
· [Cómo se publican releases](docs/RELEASES.md)

### Auto-update

Las estaciones existentes detectan nuevas versiones automáticamente al arrancar
y notifican al admin en el panel. Para desactivarlo: `AUTO_UPDATE_ENABLED=false` en `.env`.

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
| `station/` | Python 3.10 · PyQt5 · OpenCV DNN · **React + Vite** | Cámara, IA facial YuNet+SFace, registro local, UI React embebida |
| `supabase/` | PostgreSQL · pgvector · RLS · Auth | Backend multi-tenant en la nube |
| `web-panel/` | Next.js 15 · TypeScript · Tailwind CSS | Panel SaaS para empresas cliente |

### Stack interno de la estación (v4.0)

La UI de la estación es una **app React** corriendo dentro de un `QWebEngineView` (Chrome 83, Chromium embebido de PyQt5). Python y React se comunican por `QWebChannel`:

```
Python (PyQt5)
  └── QWebEngineView
        └── React App (dist/index.html — single file bundle)
              └── QWebChannel bridge
                    ├── Python → React: window.setStatus(), window.updateFrame(), window.setStationInfo(), ...
                    └── React → Python: window.bridge.startCamera(), window.bridge.registerAttendance(), ...
```

**Por qué React y no HTML embebido:**
- Diseño mantenible con componentes reutilizables y estado centralizado (Zustand)
- Animaciones fluidas con Framer Motion sin JS manual
- Tailwind CSS para estilos consistentes sin guerra de specificity
- Hot reload en desarrollo (`STATION_DEV=1` → carga `localhost:5173`)

**Restricciones del entorno (Chrome 83):**
- No soporta `@layer` CSS (Tailwind v4 usa esto → roto). Se usa **Tailwind v3** con PostCSS
- `type="module"` funciona pero `import.meta.resolve` no → se eliminó el plugin `legacy`
- `qwebchannel.js` no se inyecta automáticamente en `file://` → se carga dinámicamente desde `qrc:///qtwebchannel/qwebchannel.js`

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
| `crear_dispositivo(p_user_id, p_nombre, p_sucursal_id, p_hwid)` | Crea dispositivo para la empresa del usuario, retorna `api_key`. Registra HWID. |
| `station_heartbeat(p_api_key, p_ip_local, p_hostname, p_version, p_hwid)` | Actualiza heartbeat. Valida que el HWID coincida (anti-clonación). |
| `generar_codigo_vinculacion(p_empresa_id, p_sucursal_id, p_nombre)` | Genera código de 6 dígitos para vincular estaciones (expira en 10 min). |
| `verificar_vinculacion(p_codigo, p_hwid)` | La estación hace polling para saber si el código fue activado. |
| `activar_vinculacion(p_codigo)` | El admin confirma desde el panel web y se crea el dispositivo. |

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

── ALTERNATIVA A: Setup con credenciales (sin api_key previa) ──────────

3b. Si .env no tiene STATION_API_KEY → aparece SetupWindow
    Paso 1: Email + contraseña de admin
    Paso 2: Selecciona empresa, sucursal, nombre de la estación
    Paso 3: Llama crear_dispositivo() → guarda api_key en .env
            → captura HWID del hardware → lanza la app

── ALTERNATIVA B: Smart Pairing (código de 6 dígitos) ──────────────────

3c. Admin genera código desde panel web → Estaciones → "Vincular"
    Estación muestra campo para ingresar código
    Hace polling cada 3s esperando activación
    Admin confirma en el panel → estación recibe api_key automáticamente
    → Sin contraseñas, sin copiar keys. Seguro y rápido.
```

---

## Panel web — páginas implementadas

| Ruta | Estado | Descripción |
|---|---|---|
| `/login` | ✅ | Auth con Supabase + hero editorial (Geist + gradient + 3 pills) + Caps Lock detector |
| `/onboarding` | ✅ | Wizard 4 pasos: crear empresa + sucursal para nuevos clientes |
| `/tablero` | ✅ | **Wall en vivo** de estaciones — tiles con border-glow por estado, marcaciones recientes |
| `/mapa` | ✅ | **Vista geográfica** Leaflet — pines custom con halo, filtros, leyenda, fit-bounds |
| `/dashboard` | ✅ | KPIs del día: presentes / ausentes / salieron, tabla de actividad reciente |
| `/empleados` | ✅ | CRUD completo: crear, editar, eliminar empleados. Búsqueda en tiempo real. |
| `/sucursales` | ✅ | CRUD con horarios + **tab Ubicación** con click-to-place + geolocation API |
| `/asistencia` | ✅ | Historial de registros de asistencia |
| `/dispositivos` (Estaciones) | ✅ | Tiempo real (Realtime), crear/renombrar, ver API key, vincular por código, ver HWID |
| `/reportes` | 🔧 | Placeholder — gráficas pendientes |
| `/ejecutivo` | ✅ | Vista resumida para gerentes |
| `/actividad` | ✅ | Audit log de acciones admin |
| `/notificaciones` | ✅ | Histórico de eventos (estación offline, llegada tarde, etc.) |
| `/configuracion` | 🔧 | Placeholder — ajustes de empresa pendientes |

### Sistema de diseño (v0.7+)

| Aspecto | Valor |
|---|---|
| **Tipografía** | Geist Sans (titulares) · Inter (UI) · JetBrains Mono (datos tabulares) |
| **Paleta** | Azul `#2563eb` (acción) + Teal `#14b8a6` (datos en vivo / heartbeat) + semantic (green/yellow/red) |
| **Shell** | Sidebar (recursos) + TopBar (tabs contextuales + bell + search Cmd+K + avatar) |
| **Componentes UI** | `<PageHeader>`, `<StatusBadge>` (6 kinds), `<StatCard>`, `<LocationPicker>`, `<EmptyState>` |
| **Iconos** | `lucide-react` (uniforme, tree-shakeable) |
| **Mapa** | Leaflet vanilla + tiles CartoDB Dark (sin API key) |

### API Routes

| Endpoint | Método | Función |
|---|---|---|
| `/api/onboarding` | POST | Crea empresa + sucursal vía `crear_empresa_onboarding()` |
| `/api/dispositivos/create` | POST | Crea dispositivo vía `crear_dispositivo()` |
| `/api/dispositivos/update` | POST | Renombra un dispositivo |
| `/api/empleados/create` | POST | Crea empleado con foto (auto-enrolla si hay imagen) |
| `/api/empleados/update` | POST | Edita nombre, puesto, sucursal, activo, foto |
| `/api/empleados/delete` | POST | Elimina un empleado por ID |
| `/api/empleados/bulk` | POST | Importación masiva desde Excel (nombre, apellido, puesto, código) |

---

## Estructura del repositorio

```
/
├── station/                        # App de escritorio (estación física)
│   ├── src/
│   │   ├── main.py                 # Entry point — decide setup vs app principal
│   │   ├── windows/
│   │   │   ├── splash_window.py    # Pantalla de carga con progreso
│   │   │   ├── setup_window.py     # Wizard primera configuración (crea dispositivo)
│   │   │   ├── dashboard_window.py # Ventana principal — QWebEngineView con React
│   │   │   └── fallback_ui.py      # HTML de emergencia si no hay dist/
│   │   └── utils/
│   │       ├── supabase_client.py  # Singleton Supabase, carga .env por path absoluto
│   │       ├── station_manager.py  # Identidad (api_key) + heartbeat QThread cada 60s
│   │       ├── face_recognition_opencv.py   # YuNet (detección) + SFace (embeddings 128D) — motor principal
│   │       ├── hybrid_opencv_gemini_matcher.py  # Wrapper sobre OpenCV (Gemini desactivado)
│   │       ├── photo_to_photo_matcher.py    # Matcher HOG legacy (deshabilitado por default)
│   │       ├── paths.py                # writable_root + bundled_models_root (--onedir aware)
│   │       └── employee_mapper.py  # Carga employees_db.json y rutas de fotos
│   ├── frontend/                   # ◀ UI React (v4.0)
│   │   ├── src/
│   │   │   ├── App.tsx             # Componente raíz — registra globals de Python en window
│   │   │   ├── store/useStore.ts   # Estado global con Zustand
│   │   │   └── lib/bridge.ts       # QWebChannel bridge (carga qwebchannel.js dinámico)
│   │   ├── dist/index.html         # Build inlineado (CSS+JS en un solo archivo)
│   │   ├── vite.config.ts          # viteSingleFile + target chrome83
│   │   ├── tailwind.config.js      # Tailwind v3 (v4 usa @layer — roto en Chrome 83)
│   │   └── postcss.config.js
│   ├── models/                     # Copia local de modelos ONNX para la estación
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
│       ├── 20260429_multitenant_saas_v1.sql    # Schema base multi-tenant
│       ├── 20260430_station_monitoring.sql      # heartbeat, v_dispositivos_estado
│       ├── 20260430_onboarding_function.sql     # crear_empresa_onboarding()
│       ├── 20260430_crear_dispositivo_fn.sql    # crear_dispositivo()
│       ├── 20260501_hwid_lock.sql               # HWID anti-clonación + validación en heartbeat
│       └── 20260501_smart_pairing.sql           # Vinculación por código de 6 dígitos
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

### Estación (`station/.env` en dev, `%LOCALAPPDATA%\Safe Link Station\.env` en `.exe` instalado)

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGci...             # anon key pública

# Identidad de esta estación física
# Generar desde panel web → Dispositivos → Nueva estación
STATION_API_KEY=slm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STATION_NAME=Sucursal-Centro-1
```

#### Opcionales

| Variable | Default | Qué hace |
|---|---|---|
| `STATION_DEV` | `0` | `=1` carga UI desde `localhost:5173` (Vite HMR) en vez de `frontend/dist/`. |
| `STATION_BEEP_ON_SUCCESS` | `true` | 3 tonos al confirmar asistencia (winsound, no bloquea UI). |
| `STATION_AUTO_CLOSE` | `false` | `=true` cierra la app tras cada fichaje (single-user). Default = modo kiosko continuo. |
| `STATION_ENABLE_PHOTO_MATCHER` | `false` | Re-habilita matcher HOG legacy (solo tests). |
| `AUTO_UPDATE_ENABLED` | `true` | Check de nueva versión en GitHub Releases al arrancar. |

> Gemini Vision API estuvo soportado en v3.x como booster del matcher;
> está **desactivado por default** desde v5.x para evitar ruido y costos.
> El motor SFace puro (cosine 0.40 + gap >= 0.03) da ~99% de precisión
> con 10 embeddings/empleado, sin necesidad de Gemini.

### Panel web (`web-panel/.env.local`)

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
supabase/migrations/20260501_hwid_lock.sql
supabase/migrations/20260501_smart_pairing.sql
```

---

## Planes del producto

| Plan | Estaciones | Empleados | Funciones |
|---|---|---|---|
| Starter | 1 | hasta 50 | Asistencia básica |
| Business | 5 | hasta 500 | Multi-sucursal, reportes |
| Enterprise | ilimitado | ilimitado | API pública, integraciones RH, SLA |

---

## Estado del producto

### Sistema funcional end-to-end ✅

**Reconocimiento facial**
- Pipeline YuNet (detección) + SFace (embeddings 128D) sobre OpenCV DNN
- 10 embeddings/empleado con data augmentation v3 (flip, brillo, rotación, ruido, blur)
- Crop centrado con padding 0.4 antes de augmentar → embeddings estables (cohesión intra-empleado >0.95)
- Auto-registro al pasar `MIN_COSINE=0.40` + `gap>=0.03` + quality gate (brillo/std/laplaciano)
- Protección anti-duplicado: 60s entre fichajes del mismo empleado
- Bbox visible en pantalla estilo *viewfinder* para feedback del usuario

**Estación (`station/`)**
- App PyQt5 con UI React + Vite embebida en `QWebEngineView`
- Provisioning zero-touch (HWID lock + Smart Pairing por código de 6 dígitos)
- Heartbeat cada 60s + sync de empleados/embeddings cada 4h
- Offline queue: SQLite local + retry al volver online
- Auto-healing del `face_encodings_opencv.pkl` si se corrompe o falta
- Modo kiosko continuo (atiende fila de empleados sin reabrir entre fichajes)
- Beep audible de confirmación (winsound, thread daemon)
- Telemetría remota en tiempo real → `logs_estacion` en Supabase (ver `station/README.md`)
- `.exe` empaquetado con PyInstaller `--onedir` + auto-updater desde GitHub Releases

**Panel web (`web-panel/`)**
- Auth SSR con `@supabase/ssr` (cookies + middleware)
- Onboarding multi-tenant (crea empresa + sucursal + admin en una sola transacción)
- CRUD de empleados con drag & drop de foto + importación masiva desde Excel
- Listado de dispositivos en tiempo real (Realtime channel) con indicador online/offline
- Comandos remotos a estaciones (sync forzado, reiniciar, forzar re-enrollment)
- Vista `v_dispositivos_estado` con `SECURITY INVOKER` (respeta RLS por empresa)
- Historial de asistencias + logs de auditoría por empresa

**Backend / Supabase**
- Schema multi-tenant con RLS endurecida usando `app_metadata.empresa_id` (inmutable desde cliente)
- 35+ funciones `SECURITY DEFINER` con `search_path` fijado
- `pgvector` para embeddings (índice HNSW)
- Auto-sync trigger: cambios en `empleados` → comando push a estaciones de la empresa
- Edge Functions: `generate-embedding` para enrollment server-side
- Migraciones versionadas en `supabase/migrations/` (aplicadas vía Supabase CLI o Dashboard)

### Roadmap 🔧

**Media prioridad**
- Reportes con gráficas: `/reportes` (Recharts) — horas trabajadas, retardos, ausencias
- Configuración de empresa: `/configuracion` — editar logo, timezone, sucursales desde UI
- Notificaciones push al admin (estación offline, fichajes anómalos)
- Filtros avanzados en historial (rango fechas, sucursal, empleado) + export CSV/Excel
- Página de logs de seguridad (HWID rechazados, intentos de api_key inválida)

**Baja prioridad / futuro**
- Migrar bucket `fotos-empleados` a privado con signed URLs (cuando haya >10 empresas o datos sensibles)
- Liveness detection (anti-foto): blink, movement, texture analysis
- Cloudflare R2 cuando el egress de Supabase Storage supere ~$50/mes
- Google OAuth para admins del panel
- Billing con Stripe (Starter / Business / Enterprise)
- API pública REST para integración con sistemas de RH externos
- App móvil de consulta (React Native o PWA)

### Cambios de seguridad 2026-05-18

Ver [`web-panel/README.md` → "Decisiones de seguridad"](./web-panel/README.md) para
auditoría completa. Resumen:
- 9 ERRORS críticos de Supabase advisor → 0
- 134 WARNs → 99 (resto son por diseño: SECURITY DEFINER funcs ejecutables por anon es intencional)
- RLS hardening: `audit_log` y `webhooks` ahora usan `app_metadata.empresa_id` (no `user_metadata` modificable)
- Views `v_asistencias_hoy`, `v_kpis_sucursal_30d`, `v_dispositivos_estado` convertidas a `SECURITY INVOKER`
- 15 índices de FK creados, 35 funciones con `search_path` fijado

**UX y flujo kiosco**
- **Reset automático tras inactividad:** si no se detecta ningún rostro por X segundos después de un registro, llamar `resetEmployee()` y volver al estado idle.
- **Sonido de confirmación:** beep o chime al registrar asistencia exitosa (diferente para entrada/salida).
- **Modo de bajo rendimiento:** reducir FPS de la cámara a 15fps cuando no se detecta rostro para ahorrar CPU.
- **Panel supervisor en React:** el botón "Panel de Supervisor" ya existe — falta implementar el overlay completo con lista de registros del día y registro manual.

**Robustez**
- **Reconexión automática de cámara:** si la cámara se desconecta en mitad de sesión, reintentar cada 5s con feedback visual.
- **Logs locales de errores:** guardar en archivo `station/logs/station.log` con rotación diaria para diagnóstico sin necesidad de depurador.
- **Test de conectividad en background:** ping periódico a Supabase para actualizar el badge online/offline en tiempo real sin esperar al heartbeat.

**Build y distribución**
- **Incluir `frontend/dist/` en PyInstaller:** el `.spec` debe incluir la carpeta `dist/` del frontend para que el `.exe` encuentre el `index.html`.
- **Variable `STATION_DEV=1`:** en modo desarrollo, la estación carga `http://localhost:5173` (Vite dev server con HMR) en lugar del `dist/` estático.

---

## 🚀 Guía de despliegue completa (paso a paso)

### Fase 1: Configurar el Panel Web

```
1. Clonar el repositorio
2. cd web-panel && npm install
3. Crear .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Ejecutar todas las migraciones SQL en Supabase Dashboard → SQL Editor (en orden)
5. npm run dev → abrir http://localhost:3000
6. Crear cuenta → completar Onboarding (empresa + sucursal)
```

### Fase 2: Dar de alta empleados

```
Opción A — Manual:
  Panel Web → Empleados → "+ Nuevo Empleado"
  Llenar nombre, apellido, puesto, sucursal
  Arrastrar foto del empleado al área de drop → auto-enrolla

Opción B — Masivo (Excel):
  Panel Web → Empleados → "Importar Excel"
  Leer la guía de formato en el modal informativo
  Preparar archivo .xlsx con columnas: Nombre | Apellido | Puesto | Codigo
  Seleccionar archivo → los empleados se crean automáticamente
```

### Fase 3: Instalar estación física (.exe)

```
Opción A — Instalador rápido (requiere Python):
  1. Copiar carpeta station/ a la PC destino
  2. Ejecutar setup_station.bat (crea venv, instala deps, acceso directo)
  3. Abrir Safe Link desde el acceso directo del escritorio

Opción B — Ejecutable compilado (sin Python):
  1. En tu PC de desarrollo: station/ → build_station.bat
  2. Esperar a que termine (puede tardar varios minutos)
  3. Copiar carpeta dist/SafeLink_Station/ completa a la PC destino
  4. Ejecutar SafeLink_Station.exe
```

### Fase 4: Vincular la estación

```
Método A — Credenciales de admin:
  1. La estación muestra pantalla de Setup
  2. Ingresar email y contraseña del administrador
  3. Seleccionar empresa, sucursal, nombrar la estación
  4. El sistema genera la API Key y captura el HWID automáticamente

Método B — Código de vinculación (recomendado):
  1. Panel Web → Estaciones → "Vincular"
  2. Seleccionar sucursal (opcional), nombrar la estación
  3. Click "Generar Código" → aparece código de 6 dígitos (ej: XY9876)
  4. En la estación: click "Vincular con Código" → ingresar XY9876
  5. La estación dice "Esperando activación..."
  6. En el Panel Web: click "Confirmar Vinculación"
  7. La estación recibe la API Key automáticamente y arranca
  ⚡ Sin contraseñas, sin copiar keys. Seguro y rápido.
```

### Fase 5: Verificar funcionamiento

```
1. Panel Web → Estaciones → la nueva estación aparece "Online" (punto verde)
2. Verificar que el HWID aparece en la tarjeta de la estación
3. La estación envía heartbeat cada 60 segundos
4. Si alguien copia los archivos a otra PC → heartbeat rechazado por HWID distinto
```

### Herramientas de desarrollo y debugging

| Archivo | Función |
|---|---|
| `station/build_station.bat` | Genera el `.exe` con PyInstaller + icono oficial |
| `station/setup_station.bat` | Instala deps + crea acceso directo en escritorio |
| `station/debug_reset.bat` | Limpia `STATION_API_KEY` para re-probar el onboarding |
| `station/generar_icono.py` | Convierte `logo.png` a `icon.ico` multi-tamaño |

---

## Notas técnicas importantes

**¿Por qué SECURITY DEFINER en vez de RLS directo?**
Al crear una empresa nueva, el JWT del usuario no tiene `empresa_id` aún (se asigna durante el onboarding). RLS bloquearía el INSERT. Las funciones SECURITY DEFINER corren como el owner del schema y leen `raw_user_meta_data` de `auth.users` directamente.

**¿Por qué `router.refresh()` + `router.push()` en el login?**
`@supabase/ssr` requiere que las cookies de sesión se propaguen al Server Component antes del redirect. `window.location.replace()` no lo hace correctamente. `router.refresh()` fuerza el re-fetch del Server Component con las cookies nuevas.

**¿Por qué `(supabase as any)` en algunas queries?**
El cliente Supabase no puede inferir el tipo de retorno de JOINs complejos ni de vistas custom (`v_dispositivos_estado`). Se castea a `any` para esas queries y se usan tipos TypeScript explícitos locales.

---

## 🤖 Sistema de Embeddings Faciales

El sistema genera embeddings (vectores 128D) para reconocimiento facial de dos formas:

### Flujo 1: Server-side (Edge Function) — RECOMENDADO

```
Admin sube foto → Web Panel API
       ↓
Supabase Storage (guarda foto)
       ↓
Edge Function "generate-embedding" (descarga foto → genera embedding)
       ↓
Supabase pgvector (tabla embeddings_faciales)
       ↓
Station sync (descarga embeddings de Supabase)
       ↓
Reconocimiento facial
```

**Deployar Edge Function:**
```bash
cd supabase
supabase login
supabase link --project-ref ctmpsokjdguygjqmxyob
supabase functions deploy generate-embedding
```

### Flujo 2: Client-side (Station genera embeddings)

Si la Edge Function no está disponible, la estación genera los embeddings localmente:
- Descarga fotos desde Supabase Storage
- Genera embeddings con OpenCV DNN (YuNet + SFace)
- Los guarda localmente en `data/cache/<empresa_id>/face_encodings_opencv.pkl`

### Para regenerar embeddings manualmente

```bash
cd station
python ..\tools\diagnostics\train_encodings.py \
    --photos-dir ..\database_fotos\photos \
    --employees-json ..\database_fotos\json\employees_db.json
```

---

## 📦 Build Profesional del Installer

### Con Inno Setup (recomendado)

1. Instalar [Inno Setup 6](https://jrsoftware.org/isinfo.php)
2. Ejecutar:
```bash
cd station/build
build_professional.bat
# Seleccionar opcion 1 (Build completo)
```

Output: `dist/SafeLink_Station_v1.0.0_Setup.exe`

### Sin Inno Setup (zip portable)

```bash
cd station
build_professional.bat
# Seleccionar opcion 2 (Solo ejecutable)
```

Output: `dist/SafeLink_Station/SafeLink_Station.exe` (carpeta completa)

---

## 🔄 Auto-Update System

La estación verifica actualizaciones al arrancar:
- Check `https://updates.safelnk.com/version.txt`
- Si hay nueva versión, descarga en background
- Instala cuando el usuario lo confirme

Para configurar tu servidor de updates:
1. Hostear `version.txt` con contenido tipo `1.0.1`
2. Hostear `SafeLink_v1.0.1_Setup.exe`

**¿Qué es el HWID y por qué importa?**
El HWID (Hardware ID) es un identificador único derivado del hardware de cada PC (GUID de Windows). Se captura al registrar la estación y se valida en cada heartbeat. Si alguien clona los archivos de configuración a otra máquina, el sistema detecta la discrepancia y rechaza la conexión. Esto previene el uso no autorizado de licencias.
