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
| `/login` | ✅ | Auth con Supabase, cookies SSR, redirect post-login |
| `/onboarding` | ✅ | Wizard 4 pasos: crear empresa + sucursal para nuevos clientes |
| `/dashboard` | ✅ | Estadísticas del día, tabla de asistencias recientes |
| `/empleados` | ✅ | CRUD completo: crear, editar, eliminar empleados. Búsqueda en tiempo real. |
| `/asistencia` | ✅ | Historial de registros de asistencia |
| `/dispositivos` | ✅ | Tiempo real (Realtime), crear/renombrar, ver API key, **vincular por código**, ver HWID |
| `/reportes` | 🔧 | Placeholder — gráficas pendientes |
| `/configuracion` | 🔧 | Placeholder — ajustes de empresa pendientes |

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
│   │       ├── face_recognition_opencv.py   # YuNet (detección) + SFace (embeddings 128D)
│   │       ├── hybrid_opencv_gemini_matcher.py  # Matcher principal (OpenCV + Gemini opcional)
│   │       ├── photo_to_photo_matcher.py    # Matcher fallback foto-a-foto
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

## Estado actual del desarrollo

### Completado ✅

**Infraestructura y backend**
- Schema multi-tenant en Supabase con RLS y pgvector
- Auth SSR con `@supabase/ssr` 0.10.2 (login, cookies, middleware, redirect)
- Onboarding wizard para nuevos clientes (crea empresa + sucursal sin SQL)
- Funciones SECURITY DEFINER que bypasan RLS para onboarding y setup
- Vista `v_dispositivos_estado` con cálculo de estado automático
- Heartbeat de estación cada 60s (QThread background)
- **HWID Locking:** cada estación se vincula a su hardware físico (anti-clonación)
- **Smart Pairing:** vinculación por código de 6 dígitos (estilo Netflix/Disney+)
- **Importación masiva:** endpoint `/api/empleados/bulk` para carga desde Excel

**Panel web (web-panel/)**
- Sidebar con navegación activa, todas las páginas accesibles
- Panel de dispositivos: crear, renombrar, ver API key, **vincular por código**, ver HWID
- **Dispositivos en tiempo real:** Supabase Realtime (indicador verde pulsante)
- **CRUD completo de empleados:** crear con drag & drop de foto, editar, eliminar, búsqueda instantánea
- **Excel Import:** modal con guía de formato + carga masiva
- **Auto-enrollment:** subir foto → estado cambia a "Enrollado" automáticamente

**App de escritorio (station/)**
- SetupWindow: wizard con dos modos (credenciales o código de vinculación)
- SplashScreen — frameless + WebEngine, barra de progreso animada
- LoginWindow — CSS glassmorphism, layout cámara + formulario
- DashboardWindow — HUD corners + scan line, arco de confianza SVG
- Design system OLED dark: `#050810` bg, `#3B82F6` accent, `#22C55E` green
- **Build .exe:** `build_station.bat` genera ejecutable con icono personalizado vía PyInstaller
- **Instalador automático:** `setup_station.bat` (venv + deps + acceso directo en escritorio)
- **Debug reset:** `debug_reset.bat` para limpiar configuración y re-probar onboarding

**App de escritorio — sesión v3.0 (mayo 2026)**
- **Modo kiosco completo:** eliminado el login de empleados. La estación abre `DashboardWindow` directamente tras el splash — cámara siempre activa, sin credenciales.
- **SetupWindow reescrita en HTML/WebEngine:** diseño profesional con gradientes, animaciones y 4 pasos: credenciales → código de vinculación → selección de empresa/sucursal → éxito.
- **SetupWindow guarda Supabase en `.env`:** al completar el wizard, además de `STATION_API_KEY` también se escriben `SUPABASE_URL` y `SUPABASE_KEY` en `station/.env`, garantizando conectividad en cualquier PC nueva sin configuración manual.
- **`supabase_client.py` — fix caché de `None`:** si `URL`/`KEY` no están disponibles al arrancar (antes de completar setup), el cliente ya no cachea el fallo — reintenta en el siguiente call tras escribir `.env`.
- **`reset_supabase_client()`:** nueva función que fuerza reinicialización del cliente Supabase; se llama desde `main.py` justo antes del check de conectividad en el splash.
- **`database.py` — auto-migración SQLite:** al importar el módulo se agregan columnas faltantes (`enrollado`, `zona`, `sucursal`, `puesto`, `employee_id`, `foto_path`, `embedding_idx`) sin borrar datos — compatible con instalaciones existentes.
- **`station_manager.py` — fix QTimer threading:** el `QTimer` del heartbeat se crea dentro del método `start()` del `QThread` en lugar de en `__init__` (main thread), eliminando el warning `Timers cannot be started from another thread`.
- **DashboardWindow reescrita en HTML/WebEngine:** UI kiosco profesional — columna izquierda 60% cámara con scan line + corners de detección, columna derecha 40% panel de información con reloj grande, tarjeta de empleado, arco SVG de confianza y lista de últimos registros.
- **Modal de PIN de supervisor:** acceso admin protegido por PIN `1234`, numpad táctil, animación de shake en PIN incorrecto.
- **Panel supervisor:** overlay completo con lista de registros del día y registro manual por nombre.
- **Diálogo de confirmación de asistencia:** overlay animado con foto del empleado, tipo entrada/salida con stripe de color, datos de la asistencia y cuenta regresiva de auto-confirmación.
- **Panel derecho — mejoras visuales v3.0.1:** reloj 64px con glow, avatar empleado ampliado a 64px, arco de confianza aumentado a 96px (de 64px), circunferencia SVG y JS corregidos (251.3), separador en encabezado de registros.

### Pendiente 🔧

**Alta prioridad**
- **Enrollment en estación:** captura guiada de fotos → embedding pgvector → subida a Supabase.
- **Reportes con gráficas:** `/reportes` — gráficas de asistencia (Recharts o Chart.js).

**Media prioridad**
- **Configuración de empresa:** `/configuracion` — editar nombre, timezone, logo, sucursales.
- **Notificaciones:** alertas cuando una estación pasa a offline, llegadas tarde, ausencias.
- **Historial de asistencias mejorado:** filtros por empleado, sucursal, rango de fechas, exportar CSV/Excel.
- **Logs de seguridad:** página web para ver intentos de heartbeat rechazados por HWID.

**Baja prioridad / futuro**
- **Instalador NSIS:** `.msi` profesional con wizard de instalación Windows.
- **Billing con Stripe:** planes Starter / Business / Enterprise con límites por tenant.
- **API pública REST:** integración con sistemas de RH (Personio, BambooHR, SAP).
- **App móvil:** consulta de asistencia desde celular (React Native o PWA).

### Completado en sesión v5.0 — Zero-Touch Provisioning + Health System ✅

**Provisioning automático (zero-touch)**
- **`ProvisioningWindow`** nueva ventana que reemplaza `SetupWindow`: muestra el HWID de la máquina, hace polling silencioso a Supabase cada 5s esperando activación del admin, y al detectarla guarda `data/station_config.json` y salta al dashboard automáticamente sin intervención manual.
- **`station_config.json`**: reemplaza el `.env` manual. Guarda `api_key`, `dispositivo_id`, `empresa_id`, `sucursal_id` y `nombre`. La estación lo lee al arrancar y lo inyecta en `os.environ`.
- **`main.py` reescrito**: lógica de arranque clara — config JSON → legacy .env → provisioning. Detecta revocación desde heartbeat y relanza provisioning automáticamente.
- **`get_api_key_by_hwid(hwid)`**: nueva RPC que la estación consulta cada 5s; retorna la api_key cuando el admin activa la estación.
- **`vincular_estacion_hwid(...)`**: nueva RPC que el panel web llama al registrar; vincula HWID con la estación y genera api_key nueva.

**Health Score (0–100)**
- `station_heartbeat` ahora recibe y calcula `health_score`: cámara OK (+30) + empleados > 0 (+40) + encodings > 0 (+30).
- `report_health()` en `station_manager.py`: función global que sync_manager y dashboard_window llaman para actualizar métricas antes de cada heartbeat.
- Panel web — `DispositivoCard` muestra `HealthBar` con score, cámara, empleados sincronizados y hora del último sync.
- Estación React — `HealthPanel` en sidebar muestra barra de progreso y píldoras Cámara / Empleados / Encodings en tiempo real.

**Auto-sync al modificar empleados**
- `trg_empleado_sync`: trigger SQL en tabla `empleados` — al cambiar `foto_url`, `nombre`, `apellido` o `activo`, inserta automáticamente un comando `sync_empleados` en `comandos_estacion` para todas las estaciones de la empresa.
- `notificar_sync_empleados(empresa_id)`: RPC que también se llama explícitamente desde `/api/empleados/create` y `/api/empleados/update` para cobertura doble.
- Estaciones reciben el comando en el siguiente poll (≤10s) y hacen sync inmediato.

**Modal unificado de registro de estaciones**
- Eliminados `CrearModal`, `PairCodeModal` y `ActivarHwidModal` — reemplazados por `RegistrarEstacionModal` único con detección automática de modo: HWID presente → zero-touch (`vincular_estacion_hwid`); sin HWID → manual (genera api_key para copiar).

**Nuevas columnas en `dispositivos`**
- `hwid`, `ultima_ip`, `version_app`, `activa`, `par_codigo`, `par_expira_en`, `empleados_count`, `ultimo_sync_at`, `encodings_version`, `camara_ok`, `health_score`, `updated_at`.

**Migración aplicada**
- `supabase/migrations/20260503_provisioning.sql` — todas las RPCs y el trigger en un solo archivo. Aplicada en producción el 2026-05-03.

**Estado del sistema al cierre de sesión (2026-05-03)**
- Panel web corriendo en `localhost:3000`
- Estación `Prueba1-LOCAL` registrada en Supabase con `api_key = slm_b7990d5e...`, `activa = true`
- Heartbeat OK confirmado (logs: `Heartbeat OK — Prueba1-LOCAL`)
- Sync corriendo con 1 empleado de prueba desde el panel web
- **Pendiente**: descargar modelos DNN (`python download_models.py`) para activar reconocimiento facial — sin los modelos YuNet/SFace el sistema no puede generar embeddings ni reconocer rostros

### Completado en sesión v4.0 — React UI ✅

**Migración a Arquitectura React (completada)**
- **Frontend React + Vite:** `station/frontend/` — proyecto independiente que compila a un único `dist/index.html` inlineado (CSS + JS) para cargarse en `QWebEngineView`.
- **Tailwind v3 + PostCSS:** Tailwind v4 usa `@layer` CSS que Chrome 83 no soporta — migrado a v3 con `postcss.config.js` y `tailwind.config.js`.
- **QWebChannel dinámico:** `qwebchannel.js` no se inyecta automáticamente en `file://` — se carga dinámicamente desde `qrc:///qtwebchannel/qwebchannel.js` antes de conectar el canal.
- **Globals de Python registrados al montar:** `window.setStatus`, `window.setStationInfo`, `window.setConnectivity`, `window.updateFrame`, `window.setCamState`, `window.setBadgeText`, `window.setEmployeeInfo`, `window.setAvatar`, `window.resetEmployee`, `window.showNotRecognized`, `window.showAlreadyRegistered`, `window.setLastReg` — todos expuestos en `useEffect` antes del bridge para que Python pueda llamarlos desde el momento de carga.
- **Feed de cámara en React:** `updateFrame(b64)` muestra el frame como `<img>` base64. Cuando no hay frame, muestra un placeholder animado según el estado de la cámara (`offline`, `connecting`, `preparing`, `live`, `error`).
- **Notificaciones con auto-clear:** overlays de "No Reconocido" y "Ya Registrado" con Framer Motion, se limpian solos a los 3 segundos.
- **Fix rutas `database_fotos`:** los 5 archivos de reconocimiento facial apuntaban a `station/database_fotos/` (incorrecto) — corregido a `app_loginTrabajadores_desktop_pyqt/database_fotos/` (donde están los 57 empleados y fotos reales).

### Pendiente estación (station/) — próximos pasos 🚧

**Funcionalidad core**
- **Lógica real de reconocimiento facial:** el sistema ya corre `hybrid_opencv_gemini_matcher` y `photo_to_photo_matcher` en background — falta conectar el resultado con el registro real en Supabase (`asistencias`) y el diálogo de confirmación de asistencia en React.
- **Diálogo de confirmación en React:** al reconocer a un empleado, mostrar overlay con foto, nombre, tipo entrada/salida y botón de confirmar (con auto-confirmación por countdown).
- **Enrollment desde la estación:** el supervisor puede capturar fotos de un empleado nuevo directamente desde la cámara, generar el embedding y subirlo a Supabase.
- **Lógica entrada/salida automática:** consultar el último registro del empleado en SQLite/Supabase para proponer el tipo correcto automáticamente.
- **Sincronización offline → online:** cuando no hay internet, guardar asistencias en SQLite local (`data/db/trabajadores.db`) y subirlas a Supabase cuando se restaure la conexión.

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
