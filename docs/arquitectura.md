# Arquitectura — Safe Link

## Vista de alto nivel

```
                          ┌──────────────────────────┐
                          │       SUPABASE           │
                          │  ┌────────────────────┐  │
                          │  │   PostgreSQL       │  │
                          │  │  + RLS por empresa │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │   Auth (JWT)        │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │   Realtime          │  │
                          │  │   (WebSockets)      │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │   Storage           │  │
                          │  │   (fotos)           │  │
                          │  └────────────────────┘  │
                          │  ┌────────────────────┐  │
                          │  │   Edge Functions    │  │
                          │  │   (Deno)            │  │
                          │  └────────────────────┘  │
                          └────┬──────────────┬──────┘
                               │              │
              REST + Realtime  │              │  REST + Realtime
                               │              │
            ┌──────────────────┘              └──────────────────┐
            │                                                     │
            ▼                                                     ▼
   ┌────────────────────┐                            ┌──────────────────────┐
   │   PANEL WEB         │                            │      ESTACIÓN         │
   │  (Next.js 15)       │                            │   (PyQt5 + React)     │
   │                    │                            │                      │
   │  - Empleados       │                            │  - Cámara             │
   │  - Asistencia      │                            │  - Reconocimiento     │
   │  - Dispositivos    │                            │  - Embeddings local   │
   │  - Reportes        │                            │  - Cola offline       │
   │  - Multi-tenant    │                            │  - Heartbeat          │
   │                    │                            │                      │
   │  Roles:            │                            │  Auth:                │
   │  - superadmin      │                            │  - api_key + HWID    │
   │  - admin empresa   │                            │                      │
   └────────────────────┘                            └──────────────────────┘

       Vercel hosting                                  PCs en cada sucursal
       panel.safelink.app                              (cliente)
```

---

## Tablas principales

```
empresas                  Empresa cliente (Acme Corp, etc.)
├─ id (uuid)
├─ nombre
└─ plan

usuarios                  Admins (de Safe Link y de cada empresa)
├─ email
├─ rol: 'superadmin' | 'admin_empresa'
├─ empresa_id (NULL si superadmin)
└─ activo

sucursales                Cada locación física de la empresa
├─ empresa_id
├─ nombre
└─ direccion

dispositivos              Cada estación física activada
├─ id
├─ api_key (única, secreta)
├─ hwid (hardware fingerprint)
├─ empresa_id
├─ sucursal_id
├─ activa
├─ health_score (0-100)
├─ last_heartbeat
├─ camara_ok
├─ empleados_count
└─ encodings_ver

empleados                 Personas que se reconocen en las estaciones
├─ id
├─ empresa_id
├─ sucursal_id
├─ nombre, apellido
├─ foto_url (en Storage)
└─ enrollado (false hasta que la estación genera embedding)

embeddings_faciales       Vectores faciales para reconocimiento
├─ empleado_id
├─ empresa_id
├─ embedding (vector 512)
└─ modelo_version

registros_asistencia      Cada entrada/salida registrada
├─ empleado_id
├─ dispositivo_id
├─ tipo: 'entrada' | 'salida'
├─ timestamp
└─ confianza

comandos_estacion         Comandos del panel a las estaciones
├─ dispositivo_id
├─ empresa_id
├─ tipo: 'sync_empleados' | 'reiniciar_app' | 'limpiar_cache'
├─ creado_en
├─ ejecutado_en
└─ resultado

provisioning_tokens       Tokens de activación zero-touch (Sprint 1)
├─ token (corto, legible: ABC-123-XYZ)
├─ hwid
├─ dispositivo_id (NULL hasta activarse)
├─ empresa_id (NULL hasta activarse)
├─ sucursal_id (NULL hasta activarse)
├─ created_at
├─ expires_at (15 min)
└─ activado_en

logs_estacion             Logs operacionales que la estación envía
├─ dispositivo_id
├─ empresa_id
├─ tipo: 'sync_ok' | 'sync_error' | 'info' | 'error' | ...
├─ detalle (jsonb)
└─ creado_en

audit_log                 Auditoría de acciones admin (futuro)
├─ usuario_id
├─ accion
├─ recurso
├─ datos_antes / datos_despues
└─ ip
```

---

## Flujos críticos

### 1. Activación zero-touch de estación (Sprint 1)

```
ESTACIÓN                     SUPABASE                   PANEL WEB
   │                              │                          │
   │ crear_token_provisioning(hwid)                          │
   │─────────────────────────────►│                          │
   │ ◄─────────── token + url     │                          │
   │ muestra QR                   │                          │
   │                              │                          │
   │ se suscribe a:               │                          │
   │ realtime:provisioning:<token>│                          │
   │ ◄═══════════════════════════►│                          │
   │                              │                          │
   │                              │  admin escanea ─────────►│
   │                              │                /activar?token=...
   │                              │                          │
   │                              │ activar_token(...) ◄─────│
   │                              │  - asigna empresa/suc    │
   │                              │  - genera api_key        │
   │                              │  - notifica via Realtime │
   │                              │                          │
   │ ◄═══ activación ═════════════│                          │
   │ guarda config local          │                          │
   │ reinicia                     │                          │
   │ → dashboard normal           │                          │
```

### 2. Sync de empleados (post-activación)

```
PANEL                  SUPABASE                  ESTACIÓN
  │                       │                          │
  │ crear empleado         │                          │
  │ + foto a Storage       │                          │
  │──────────────────────►│                          │
  │                       │ trigger: enrollado=false │
  │                       │ + insertar comando       │
  │                       │   sync_empleados         │
  │                       │                          │
  │                       │ Realtime push ──────────►│
  │                       │                          │
  │                       │ ◄── force_sync ─────────│
  │                       │ ◄── descarga foto ──────│
  │                       │                          │
  │                       │   <generación embedding> │
  │                       │                          │
  │                       │ ◄── upload embedding ────│
  │                       │ ◄── enrollado=true ──────│
```

### 3. Registro de asistencia (operación normal)

```
EMPLEADO         ESTACIÓN              SUPABASE              PANEL
   │                 │                       │                    │
   │ se acerca       │                       │                    │
   │────────────────►│                       │                    │
   │                 │ <reconocimiento>       │                    │
   │                 │ confianza ≥ 0.85       │                    │
   │                 │                       │                    │
   │                 │ registrar_asistencia ─►│                    │
   │                 │                       │ INSERT registros    │
   │                 │                       │ Realtime push ─────►│
   │                 │ ◄─ ok ────────────────│              "EN VIVO"
   │                 │                                            │
   │ campanita 🔔     │                                            │
   │ "Bienvenido X"  │                                            │
```

---

## Stack tecnológico

| Capa | Tecnología | Por qué |
|---|---|---|
| Base de datos | PostgreSQL 15 (vía Supabase) | Robusto, RLS multi-tenant, jsonb, realtime |
| Backend | Edge Functions (Deno + TS) | Sin servidores, deploy en 5s |
| Auth | Supabase Auth (JWT) | Magic links, MFA, OAuth |
| Realtime | Supabase Realtime (Phoenix Channels) | WebSockets nativos sobre PostgreSQL changes |
| Storage | Supabase Storage (S3 compat) | Fotos de empleados, logos |
| Panel UI | Next.js 15 (App Router) | SSR + RSC, mejor SEO/perf |
| Panel UI lib | React 18 + Tailwind CSS | Modern, server components, design tokens |
| Panel tipografía | Geist Sans + Inter + JetBrains Mono | Identidad B2B SaaS pro con datos tabulares legibles |
| Panel mapa | Leaflet vanilla + CartoDB Dark tiles | Sin API key, sin costo, sin dependencias frágiles |
| Panel iconos | lucide-react | Set uniforme, tree-shakeable, stroke consistente |
| Estación core | Python 3.10+ + PyQt5 | Acceso nativo a cámara, GPU para ML |
| Estación UI | React (single-file bundle) | Reutilizar componentes con web |
| Reconocimiento | OpenCV + SFace + YuNet | DNN preentrenadas, sin servicios externos |
| Hosting panel | Vercel | Zero-config, deploy por git push |

---

## Sistema de diseño del panel web (v0.7+)

El panel implementa un sistema de diseño formal con tokens centralizados en
`web-panel/src/app/globals.css`. Esto permite consistencia visual sin css-in-js
ni runtime tailwind plugins.

### Tokens de marca

```
--accent       #2563eb   Azul primario (acciones, estado activo)
--accent-hover #3b82f6
--teal         #14b8a6   Secundario — "tiempo real / datos / heartbeat"
--teal-hover   #2dd4bf

--green        #22c55e   Estado: online / presente
--yellow       #eab308   Estado: warn / alerta
--red          #ef4444   Estado: error / offline

--bg-black     #070708   Surface base
--bg-card      #0f0f10   Cards
--bg-elevated  #161618   Inputs, hover state
```

### Tipografía triple

| Token | Familia | Uso |
|---|---|---|
| `--font-body` | Inter | Cuerpo, UI, labels, párrafos |
| `--font-heading` | Geist Sans | h1/h2/h3, brand mark, topbar tabs, section labels |
| `--font-data` | JetBrains Mono | Coordenadas, API keys, IPs, IDs, timestamps, contadores |

Autohosteadas por `next/font` (zero CLS). Geist se importa del paquete oficial `geist`,
Inter y JetBrains Mono del subset Latin de Google Fonts.

### Componentes del shell

| Componente | Responsabilidad |
|---|---|
| **Sidebar** (`sidebar-nav.tsx`) | Catálogo de recursos: OrgSwitcher + 3 grupos (Operación/Análisis/Sistema). 9 items totales — sin duplicar las vistas del topbar. |
| **TopBar** (`topbar.tsx`) | Contexto de la sección actual: tabs contextuales (solo en grupo Inicio), búsqueda `Cmd+K`, bell con badge real desde `notificaciones`, avatar. |
| **PageHeader** (`components/ui/PageHeader.tsx`) | Hero unificado con patrón `Título · count`. Soporta eyebrow, subtitle, icon chip, stats inline, actions slot. |
| **StatusBadge** (`components/ui/StatusBadge.tsx`) | Dot + label con 6 kinds: `online`, `warn`, `offline`, `error`, `neutral`, `live`. Variante `strong` activa el halo animado (`live-pulse` 2.4s). |
| **EstacionTile** (clase CSS `.estacion-tile`) | Card con border + glow `color-mix` por estado, accent line superior, hover con lift + glow intensificado. |
| **LocationPicker** (`components/ui/LocationPicker.tsx`) | Mini-mapa Leaflet con click-to-place, drag, geolocation API con feedback de precisión. |
| **MetricChip** (clase CSS `.metric-chip`) | Pill compacto con dot de color, label, value en mono. Hover con border tinted al color. |

### Páginas nuevas (v0.7+)

| Ruta | Propósito | Componentes clave |
|---|---|---|
| `/tablero` | Wall en vivo de estaciones estilo monitoring | Hero con metric chips, segmented filter, density toggle, grid de `.estacion-tile`, aside de marcaciones recientes |
| `/mapa` | Vista geográfica de sucursales | `MapView` Leaflet vanilla, pines custom `.sl-pin` con halo animado, segmented filter por estado, overlays flotantes (counter + leyenda), aside con `SucursalRow` clicable |

### Animaciones curated (no decorativas)

| Animación | Cuándo | Duración |
|---|---|---|
| `live-pulse` | Dots de `StatusBadge strong` | 2.4s loop |
| `tile-accent-breathe` | Línea acento superior de tiles online | 4s loop |
| `tab-underline-in` | Subrayado del tab activo al cambiar de sección | 240ms cubic-bezier |
| `sl-pin-halo` | Halo de pines del mapa para sucursales online/seleccionadas | 2.4s loop |
| `bio-line-flow` | (Eliminado — el login antiguo tenía radar animado, ahora es editorial) | — |

---

## Decisiones de diseño

**¿Por qué embeddings locales en cada estación?**
- Privacidad: las caras nunca salen de la sucursal del cliente
- Latencia: <100ms de reconocimiento sin viajar a internet
- Resiliencia: funciona offline durante cortes de red

**¿Por qué Supabase y no AWS/Firebase?**
- PostgreSQL real (no NoSQL como Firestore)
- RLS multi-tenant nativo (más simple que IAM custom)
- Pricing predecible vs spike de Firestore
- Realtime sin servicios externos

**¿Por qué Next.js y no SPA?**
- SEO para landing/marketing en mismo proyecto
- React Server Components → menos JS al cliente
- API routes integradas (sin servicio aparte)

**¿Por qué PyQt5 + React híbrido en estación?**
- Python: ML/CV maduro, OpenCV nativo
- PyQt5: acceso a hardware (cámara, GPU)
- React UI embebida: compartir diseño con panel web

**Trade-off:** la complejidad de tener WebEngine + Python + React. En el futuro
podríamos migrar a UI nativa pura PyQt5 si el bundle web da más problemas.

---

## Multi-tenant: aislamiento por empresa

Cada empresa cliente está aislada vía **Row Level Security (RLS)** en PostgreSQL.

Ejemplo de policy:

```sql
CREATE POLICY empleados_empresa ON empleados
  USING (empresa_id = auth_empresa_id());
```

`auth_empresa_id()` lee del JWT del usuario. Un admin de Acme Corp solo ve
filas con `empresa_id = 'acme-uuid'`, sin importar qué query haga.

Para superadmins (equipo Safe Link) hay una bypass policy:

```sql
CREATE POLICY empleados_superadmin ON empleados
  USING (auth_es_superadmin());
```

Las estaciones se autentican con `api_key` (no JWT) y solo pueden acceder
a su empresa via RPCs específicos que validan ownership.
