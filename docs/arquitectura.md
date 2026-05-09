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
| Panel UI lib | React 19 + CSS-in-JS | Modern, server components |
| Estación core | Python 3.10+ + PyQt5 | Acceso nativo a cámara, GPU para ML |
| Estación UI | React (single-file bundle) | Reutilizar componentes con web |
| Reconocimiento | OpenCV + SFace + YuNet | DNN preentrenadas, sin servicios externos |
| Hosting panel | Vercel | Zero-config, deploy por git push |

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
