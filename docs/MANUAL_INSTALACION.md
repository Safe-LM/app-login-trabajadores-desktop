# Safe Link — Manual de instalación

> **Para administradores y operadores.** Este manual cubre la instalación y puesta en
> marcha de los dos componentes de Safe Link Monitoring:
>
> 1. **Panel web** (`panel.safelink.app`) — consola SaaS de administración multi-tenant
> 2. **Estación física** (`SafeLinkStation_Setup.exe`) — app de escritorio para reconocimiento
>    facial en cada sucursal
>
> Tiempo total: **5–10 min por componente**. No requiere conocimientos de SQL ni programación.

---

## Tabla de contenido

- [1. ¿Qué es Safe Link?](#1-qué-es-safe-link)
- [2. Antes de empezar — requisitos](#2-antes-de-empezar--requisitos)
- [3. Instalación del Panel Web](#3-instalación-del-panel-web)
- [4. Instalación de la Estación física](#4-instalación-de-la-estación-física)
- [5. Verificación end-to-end](#5-verificación-end-to-end)
- [6. Operación diaria](#6-operación-diaria)
- [7. Actualizaciones](#7-actualizaciones)
- [8. Desinstalación](#8-desinstalación)
- [9. Solución de problemas](#9-solución-de-problemas)
- [10. Soporte](#10-soporte)

---

## 1. ¿Qué es Safe Link?

**Safe Link Monitoring** es una plataforma SaaS B2B para control biométrico de asistencia
laboral. Cada empresa cliente instala estaciones físicas en sus sucursales (una PC con
cámara web) que reconocen a los empleados por su rostro y registran sus marcaciones de
entrada/salida en la nube. El administrador gestiona empleados, sucursales y reportes
desde un panel web sin necesidad de tocar bases de datos.

### Arquitectura simplificada

```
┌──────────────────┐        ┌─────────────────┐        ┌──────────────────┐
│  Estación física │──────▶ │    Supabase     │ ◀──────│   Panel web      │
│  (PC + cámara)   │  API   │  (cloud DB)     │  SSR   │ (panel.safelink) │
│                  │  REST  │  PostgreSQL +   │  API   │  Multi-tenant    │
│  Python + React  │        │  RLS + Realtime │        │  Next.js 15      │
└──────────────────┘        └─────────────────┘        └──────────────────┘
       ▲                                                          │
       │ heartbeat cada 60s                                       │
       └────── estado online/offline visible en tiempo real ──────┘
```

### Roles

| Rol | Quién | Qué hace |
|---|---|---|
| **Empleado** | Colaborador de la empresa | Se para frente a la estación → marca entrada/salida |
| **Administrador** | Dueño/RH de la empresa cliente | Crea empleados, sucursales y estaciones desde el panel |
| **Superadmin** | Equipo Safe Link | Soporte, monitoreo cross-empresa, releases |

---

## 2. Antes de empezar — requisitos

### Para el Panel web

| Requisito | Detalle |
|---|---|
| Navegador | Chrome 120+, Edge 120+, Firefox 121+, Safari 17+ |
| Internet | Estable (≥5 Mbps) |
| Cuenta | Email + contraseña entregados por Safe Link (o link de onboarding) |
| Dispositivo | Cualquier laptop/desktop. Resolución mínima recomendada: 1366×768 |

### Para la Estación física

| Requisito | Detalle |
|---|---|
| Sistema operativo | Windows 10 / 11 (64 bits) |
| Cámara | Webcam USB o integrada del laptop (resolución mínima 720p) |
| Procesador | Intel i3 8va gen o equivalente AMD (para inferencia ML local) |
| RAM | 4 GB mínimo, 8 GB recomendado |
| Espacio | 280 MB libres en disco |
| Internet | Estable para sincronizar (la estación tiene buffer offline) |
| Permisos | Administrador local en la PC para instalar |
| Instalador | `SafeLinkStation_Setup.exe` (descarga de [GitHub Releases](https://github.com/Safe-LM/app-login-trabajadores-desktop/releases/latest)) |

---

## 3. Instalación del Panel Web

> No requiere instalación de software — es una aplicación web. Solo necesitas un navegador.

### Paso 3.1 — Recibir credenciales

El equipo de Safe Link te proporciona uno de estos dos accesos:

**Opción A: Credenciales directas** (empresa ya creada)

```
URL:        https://panel.safelink.app
Email:      admin@tuempresa.com
Password:   (entregada en sobre sellado o por canal seguro)
```

**Opción B: Link de onboarding** (empresa nueva — zero-touch)

```
https://panel.safelink.app/activar?token=ABC-123-XYZ
```

### Paso 3.2 — Primer ingreso

1. Abre el navegador en la URL proporcionada
2. Si tienes credenciales: ingresa email + password en el form de login
3. Si tienes link de onboarding: llena el wizard
   - Nombre de tu empresa
   - Tu email como administrador
   - Contraseña (mínimo 8 caracteres)
   - Primera sucursal (nombre + ciudad)
4. Al hacer login serás redirigido a `/tablero` (vista principal)

### Paso 3.3 — Recorrido inicial (5 min)

Familiarízate con las secciones del sidebar:

| Grupo | Sección | Para qué |
|---|---|---|
| **Operación** | Inicio (`/tablero`) | Wall en vivo de tus estaciones |
| | Empleados (`/empleados`) | Crear y gestionar personas |
| | Sucursales (`/sucursales`) | Locales físicos con ubicación en mapa |
| | Estaciones (`/dispositivos`) | Las PCs físicas con cámara |
| **Análisis** | Reportes (`/reportes`) | Horas trabajadas, retardos |
| | Ejecutivo (`/ejecutivo`) | KPIs para gerencia |
| | Actividad (`/actividad`) | Audit log |
| **Sistema** | Notificaciones (`/notificaciones`) | Histórico de eventos |
| | Configuración (`/configuracion`) | Datos de la empresa |

**Búsqueda global**: presiona `Cmd+K` (Mac) o `Ctrl+K` (Windows) para abrir la paleta
de comandos y navegar rápido.

### Paso 3.4 — Configurar primera sucursal con ubicación

1. Sidebar → **Sucursales** → botón **`+ Nueva sucursal`**
2. Tab **Información**: nombre, dirección
3. Tab **Horario**: hora apertura, cierre, tolerancia (minutos)
4. Tab **Ubicación**:
   - Click en **"Mi ubicación"** para usar el GPS de tu equipo, o
   - Click en cualquier punto del mapa para colocar el pin manualmente
   - Arrastra el pin para afinar
   - Las coordenadas se muestran en formato `19.43260° -99.13320°`
5. Click **"Crear sucursal"**
6. Verifica en sidebar → **Mapa** que el pin aparezca con halo cyan pulsando

### Paso 3.5 — Crear empleados

1. Sidebar → **Empleados** → **`+ Nuevo empleado`**
2. Llena nombre, apellido, código de empleado, sucursal asignada
3. **Sube una foto frontal clara** del empleado (idealmente con buena iluminación,
   sin lentes oscuros, mirando a cámara)
4. Click **Guardar**

> 📸 La foto se sube a Supabase Storage y la estación la descargará automáticamente
> en su próxima sincronización para generar los embeddings faciales.

---

## 4. Instalación de la Estación física

### Visión general del flujo

A diferencia de versiones anteriores, el instalador es **deliberadamente simple**
y la identidad de la estación se asigna **después** de instalar. Esto evita que
el operador físico tenga que copiar API Keys largas a mano (propenso a typos) y
mantiene las credenciales fuera de capturas o documentos del wizard.

```
1. Descargar .exe           →  2. Ejecutar wizard         →  3. Registrar estación
   (sin pre-pasos del panel)    (pide solo nombre +           (ventana de Setup,
                                 autostart con Windows)         ver Paso 4.5)
```

### Paso 4.1 — Descargar el instalador

Desde el equipo donde vas a instalar la estación, ve a:

```
https://github.com/Safe-LM/app-login-trabajadores-desktop/releases/latest
```

Descarga el archivo `SafeLinkStation_Setup.exe` (~280 MB). Guárdalo en **Descargas**.

> 💡 **No necesitas crear nada en el panel antes.** El instalador no pide URL
> Supabase, ni Anon Key, ni API Key — todo eso viene resuelto adentro del .exe
> o se obtiene en el primer arranque.

### Paso 4.2 — Ejecutar el instalador

1. Doble click en `SafeLinkStation_Setup.exe`
2. Si Windows muestra **"Editor desconocido"** (normal — el `.exe` aún no está
   firmado digitalmente):
   - Click en **"Más información"** → **"Ejecutar de todas formas"**
3. Acepta el aviso UAC ("Control de cuentas") → **Sí**

Aparece el wizard de Inno Setup. Click **Siguiente**.

### Paso 4.3 — Carpeta de instalación

```
┌─────────────────────────────────────────────┐
│   Carpeta de Destino                        │
│                                             │
│   C:\Program Files\Safe Link Station\       │
│                              [ Examinar ]   │
│                                             │
│   Espacio requerido: ~280 MB                │
│                                             │
│         [ < Atrás ]  [ Siguiente > ]        │
└─────────────────────────────────────────────┘
```

Deja la ruta por defecto y click **Siguiente**.

> 💡 Si tu disco C: tiene poco espacio, puedes cambiar a `D:\Safe Link Station\`.

### Paso 4.4 — Configuración inicial del wizard

Aquí solo hay **2 campos** — los únicos que pide el instalador:

```
┌──────────────────────────────────────────────────────────┐
│  Configuración inicial                                   │
│  Asigna un nombre a esta estación.                       │
│                                                          │
│  Tras la instalación, Safe Link Station te pedirá las   │
│  credenciales del administrador (o un código de         │
│  vinculación) para registrar esta estación en tu cuenta.│
│                                                          │
│  Nombre de la estación:                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Estacion-1                                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ☑ Iniciar automáticamente con Windows                  │
│                                                          │
│         [ < Atrás ]  [ Siguiente > ]                     │
└──────────────────────────────────────────────────────────┘
```

| Campo | Valor |
|---|---|
| **Nombre de la estación** | Es solo un placeholder local. El nombre real lo elegirás en el siguiente paso (Setup). Puedes dejar `Estacion-1` o poner algo descriptivo. |
| **Iniciar con Windows** | ☑ Marca esta casilla si la PC se usa 24/7 (recomendado para producción). |

Click **Siguiente** → **Instalar** → **Finalizar**.

### Paso 4.5 — Registro de la estación (Setup post-instalación)

Al terminar el wizard, la estación arranca por primera vez. Como aún no tiene
identidad asignada, te muestra la ventana **"Configuración inicial"** para
registrarla en el panel.

#### 🟢 Modo principal: Setup con login admin (recomendado, 90% de los casos)

Funciona si tienes a mano las credenciales del administrador de la empresa.

```
┌──────────────────────────────────────────────────────────┐
│  Configuración inicial                                   │
│  Esta estación aún no está registrada.                   │
│  Ingresa tus credenciales de administrador para continuar│
│                                                          │
│  Email del administrador:                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ admin@tuempresa.com                                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Contraseña:                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ••••••••••                                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                              [ Iniciar sesión ]          │
└──────────────────────────────────────────────────────────┘
```

1. Ingresa **email** + **contraseña** del admin de la empresa
2. La estación se autentica contra Supabase y te muestra:
   - **Empresa** (preseleccionada si solo tienes una)
   - **Sucursal** (dropdown con todas las sucursales de tu empresa)
   - **Nombre de la estación** (puedes dejar el del wizard o cambiarlo, ej:
     `Recepción Norte`, `GERENCIA_Oficina-Central`)
3. Click **Registrar**
4. La estación llama al RPC `crear_dispositivo()` en Supabase, recibe la **API Key**
   y la guarda **automáticamente** en `.env` (sin que tú la veas ni la copies)
5. Aparece la pantalla de éxito:

```
┌──────────────────────────────────────────────────────────┐
│            ✓ ¡Estación registrada!                       │
│                                                          │
│   La API Key fue guardada automáticamente.               │
│   Ya puedes iniciar Safe Link Monitoring.                │
│                                                          │
│   Nombre: GERENCIA_Oficina-Central                       │
│   ID:     e2064bd4-5d4d-47f3-999...                      │
│                                                          │
│            [ ▶ Iniciar Safe Link Monitoring ]            │
└──────────────────────────────────────────────────────────┘
```

6. Click **▶ Iniciar Safe Link Monitoring** → la estación abre la app en
   modo kiosco

> ✅ **Ventajas del modo principal**: una sola ventana, sin tocar el `.env`,
> sin copiar API Keys.

#### 🔵 Modo alternativo: Manual con API Key

Útil cuando el técnico que instala físicamente la estación **no debe conocer
el password del admin** (por ejemplo, instalaciones por terceros, IT externo,
o pre-aprovisionamiento de varias máquinas).

**El admin (en una computadora con acceso al panel):**

1. Panel web → sidebar → **Estaciones** → botón **`+ Registrar estación`**
2. Llena en el modal:
   - **Nombre** (ej: `Recepción Norte`)
   - **Sucursal** (asignada)
   - **ID de hardware**: déjalo **vacío**
3. Click **Registrar estación**
4. El panel muestra la **API Key generada**, formato `sk_xxxxxxxxxxxxxxxx`
5. Click **Copiar API Key** y entrégasela al técnico por canal seguro
   (no email común — mejor un gestor de contraseñas, Signal, o un sobre cerrado)

> 🚨 **La API Key solo se muestra una vez completa**. Si se pierde, hay que
> eliminar la estación del panel y crearla de nuevo.

**El técnico (en la PC donde está la estación):**

1. Termina de instalar el .exe (sigue con `Estacion-1` o el nombre que sea
   en el wizard — no importa)
2. Cuando arranca la estación y muestra la ventana de Setup, cierra esa
   ventana (botón Cancelar o ✕)
3. Abre **Bloc de notas como administrador**:
   - Menú Inicio → escribe `Bloc de notas`
   - Click derecho → **Ejecutar como administrador**
4. Archivo → Abrir → navega a:
   ```
   C:\Program Files\Safe Link Station\.env
   ```
5. Agrega al final del archivo una nueva línea:
   ```
   STATION_API_KEY=sk_xxxxxxxxxxxxxxxx
   ```
   (reemplazando `sk_xxxxxxxxxxxxxxxx` con la API Key real que recibió)
6. Guarda el archivo (`Ctrl+S`) y cierra Bloc de notas
7. Reinicia la estación (cierra el .exe y vuelve a abrirla desde el menú
   Inicio o el shortcut del escritorio)

La estación arranca, lee la `STATION_API_KEY` del `.env`, se identifica
contra Supabase y entra directo al modo de operación (sin ventana de Setup).

> ⚠️ Si abres el `.env` con doble click sin "como administrador", Windows
> no te dejará guardar (la carpeta `Program Files` está protegida).

### Paso 4.6 — Primera ejecución de la estación

Independiente del modo que hayas usado en 4.5, al iniciar la estación verás:

1. **Splash** con logo Safe Link mientras carga (~5 segundos)
2. Pide acceso a la cámara → acepta cuando Windows pregunte
3. **Sincroniza la lista de empleados** con Supabase (~30 segundos)
4. Por cada empleado con foto, genera **10 embeddings faciales** y los sube
   a la nube
5. Cuando aparece **"Listo — buscando rostro…"**, la estación está activa

> 📡 La primera sincronización puede tardar 1-2 minutos si hay muchos empleados.
> Verás "Sincronizando..." en la parte superior derecha.

---

## 5. Verificación end-to-end

### Checklist en la estación

- [ ] Logo `SAFE LINK MONITORING` visible arriba a la izquierda
- [ ] Cámara muestra video en vivo (no pantalla negra)
- [ ] Indicador "EN LÍNEA" verde en esquina superior derecha
- [ ] Reloj en vivo actualizándose cada segundo
- [ ] Mensaje "Buscando rostro..." abajo de la cámara
- [ ] Al pararse frente a la cámara: detecta el rostro (cuadro rojo/verde)

### Checklist en el panel web

1. Sidebar → **Tablero** → debes ver la nueva estación como tile con border verde y halo pulsando
2. Sidebar → **Estaciones** → la estación aparece con badge **`● En línea`** (dot verde animado)
3. El heartbeat debe ser reciente (`hace 12s`, `hace 30s`, etc.)
4. Sidebar → **Mapa** → si la sucursal de esta estación tiene ubicación, el pin debe ser verde

### Prueba de marcación

1. Para frente a la estación a un empleado con foto enrollada en el panel
2. La estación debe reconocerlo en <1 segundo y mostrar `✓ Bienvenido, [Nombre]`
3. Suena la campanita 🔔
4. Panel web → Sidebar → **Dashboard** → el empleado aparece en la tabla de asistencias
5. Sidebar → **Tablero** → aside derecho "Marcaciones recientes" actualiza en tiempo real

✅ **Si todo lo anterior pasa, la instalación es exitosa.**

---

## 6. Operación diaria

### Para el administrador (panel web)

- **Tablero**: revisar al inicio del día que todas las estaciones estén "En línea"
- **Dashboard**: ver KPIs del día (presentes, ausentes, asistencia %)
- **Notificaciones**: revisar el bell 🔔 — alertas de estaciones offline o llegadas tarde
- **Empleados**: agregar/desactivar empleados cuando cambien en la empresa
- **Reportes**: exportar a Excel al final del mes

### Para los empleados (estación)

- Solo pararse frente a la cámara con la cara visible
- Esperar la confirmación visual + sonora (~1 seg)
- Si no reconoce: alejarse 1 metro y volver a acercarse
- Si persiste: avisar al admin para verificar que su foto esté actualizada

### Para tickets/incidencias (panel)

- **Estación se cae** (offline): el panel notifica vía toast top-right + bell
- **Empleado no reconoce**: el panel registra en logs; admin puede regenerar foto
- **Cambio de sucursal**: editar el empleado, asignar nueva sucursal

---

## 7. Actualizaciones

### Panel web

Se actualiza automáticamente — solo recarga la página (`Ctrl+Shift+R`). No requiere
acción del cliente. Los releases se anuncian en el panel mediante banner top.

### Estación

La estación detecta nuevas versiones al arrancar y muestra una notificación:

- **Aceptar** → descarga e instala automáticamente (~2 min)
- **Rechazar** → sigue con la versión actual; te avisará la próxima vez

Para desactivar auto-updates, agrega al archivo `C:\Program Files\Safe Link Station\.env`:

```
AUTO_UPDATE_ENABLED=false
```

---

## 8. Desinstalación

### Estación

**Opción A — Desde menú Inicio:**
1. Menú Inicio → buscar `Safe Link Station`
2. Click derecho → **Desinstalar**

**Opción B — Desde Configuración de Windows:**
1. Configuración → Aplicaciones → Aplicaciones instaladas
2. Buscar `Safe Link Station` → `⋯` → **Desinstalar**

> 💾 **Tus datos** (asistencias offline en `data/db/`, logs) se conservan por seguridad.
> Si quieres borrarlo todo, elimina manualmente `C:\Program Files\Safe Link Station\`
> después de desinstalar.

### Panel web

No hay que desinstalar nada. Si una empresa quiere darse de baja, contacta al soporte
de Safe Link para eliminar su tenant y datos.

---

## 9. Solución de problemas

### Panel web

| Problema | Solución |
|---|---|
| Login OK pero `/dashboard` redirige a `/login` | El middleware no encuentra `empresa_id` en el JWT — pide al admin que vuelva a crear tu usuario vía onboarding |
| Tabla de empleados vacía aunque existen | RLS está bloqueando — contacta soporte |
| Mapa no carga (pantalla negra) | Verifica internet — los tiles vienen de CartoDB CDN |
| Pin de sucursal no aparece en `/mapa` | La sucursal no tiene `lat/lng` — edita en `/sucursales` → tab Ubicación |
| Notificaciones no llegan en tiempo real | Verifica que Realtime esté habilitado en tu plan Supabase |

### Estación

| Problema | Solución |
|---|---|
| "Editor desconocido" al ejecutar el instalador | Normal sin firma digital. Click "Más información" → "Ejecutar de todas formas". |
| "Cámara no disponible" | Cierra Teams/Zoom/Skype/cualquier app que use la cámara. Reinicia la estación. |
| "Estación sin conexión" en el panel | Verifica internet. La estación reintentará cada 60s. |
| El instalador se cierra sin avisar | Ejecuta como administrador (click derecho → "Ejecutar como administrador"). |
| No genera embeddings | Verifica que los empleados tengan foto subida en el panel. |
| Cámara invertida o lateral | Es una limitación de la cámara, no del software. |
| No reconoce empleados nuevos | Espera 60s tras crearlos en el panel — la sincronización es automática. |
| Heartbeat se queda en "hace 5 min" o más | La estación perdió internet o se cerró. Verifica que esté corriendo + conectividad. |

### Cómo editar la configuración después de instalar

Edita el archivo:

```
C:\Program Files\Safe Link Station\.env
```

Abre con **Bloc de notas como administrador** (click derecho → "Ejecutar como administrador").
Modifica los valores y reinicia la estación.

> ⚠️ Si abres con doble click sin "como administrador", Windows no te dejará guardar.

---

## 10. Soporte

| Canal | Para qué |
|---|---|
| **Email** | soporte@safelink.app — soporte general, dudas, incidencias |
| **GitHub** | [github.com/Safe-LM/app-login-trabajadores-desktop](https://github.com/Safe-LM/app-login-trabajadores-desktop) — issues técnicos, request de features |
| **Logs estación** | `C:\Program Files\Safe Link Station\logs\` — útil al reportar bugs |
| **Docs técnicas** | [`docs/arquitectura.md`](arquitectura.md), [`docs/runbook-estacion.md`](runbook-estacion.md), [`docs/runbook-panel.md`](runbook-panel.md) |

### Datos a incluir en un ticket de soporte

1. **ID de empresa** (visible en el panel → Configuración)
2. **Nombre de la estación afectada** (si aplica)
3. **Captura de pantalla** del problema
4. **Hora exacta** del incidente
5. **Logs** (si es un problema de estación, adjuntar archivos de `logs/`)

---

**Versión del manual**: para Safe Link Station 5.7+ y Panel web 0.7+.
**Última actualización**: 2026-05-20.
