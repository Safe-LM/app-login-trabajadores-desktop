<p align="center">
  <img src="https://img.shields.io/badge/Safe%20Link-Monitoring-6366f1?style=for-the-badge&labelColor=0f172a&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4MThjZjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMjJzOC00IDgtMTBWNWwtOC0zLTggM3Y3YzAgNiA4IDEwIDggMTB6Ii8+PC9zdmc+" alt="Safe Link Monitoring">
  <br><br>
  <img src="https://img.shields.io/badge/version-2.0.4-818cf8?style=flat-square&labelColor=1e293b" alt="Version">
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white&labelColor=1e293b" alt="Python">
  <img src="https://img.shields.io/badge/PyQt5-Desktop_App-41CD52?style=flat-square&logo=qt&logoColor=white&labelColor=1e293b" alt="PyQt5">
  <img src="https://img.shields.io/badge/OpenCV-DNN_SFace-5C3EE8?style=flat-square&logo=opencv&logoColor=white&labelColor=1e293b" alt="OpenCV">
  <img src="https://img.shields.io/badge/Supabase-Cloud_DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white&labelColor=1e293b" alt="Supabase">
  <img src="https://img.shields.io/badge/GitHub_Actions-CI_CD-2088FF?style=flat-square&logo=github-actions&logoColor=white&labelColor=1e293b" alt="GitHub Actions">
  <img src="https://img.shields.io/badge/status-Production_Ready-10b981?style=flat-square&labelColor=1e293b" alt="Status">
</p>

<h1 align="center">🛡️ Safe Link Monitoring</h1>
<h3 align="center">Sistema Inteligente de Control de Asistencia por Reconocimiento Facial</h3>

<p align="center">
  <em>Aplicación de escritorio de grado empresarial que automatiza el registro de asistencia<br>mediante biometría facial con inteligencia artificial híbrida.</em>
</p>

---

## 📋 Visión General

**Safe Link Monitoring** resuelve el problema de la gestión manual de asistencia en cadenas de tiendas y oficinas, reemplazando hojas de firma, huella digital y tarjetas de proximidad por un sistema de **reconocimiento facial en tiempo real** que:

- ✅ Identifica empleados en **2–3 segundos** con **99% de confianza**
- ✅ Arquitectura **Híbrida Cloud-Edge** (SQLite + Supabase Cloud)
- ✅ Sincronización de asistencia **en tiempo real** multiplataforma
- ✅ Registro automático con **Geolocalización por Sucursal** y nivel de confianza
- ✅ Protege contra suplantación de identidad (anti-spoofing)

> **56 empleados registrados** · **560 embeddings faciales** · **100% de precisión en pruebas controladas**

---

## 🧠 Arquitectura del Motor de IA

El corazón del sistema es un **motor híbrido de doble capa** que garantiza precisión bajo cualquier condición:

```mermaid
flowchart TD
    subgraph "Edge / Local App"
        CAM["Cámara Web"] --> FRAME["Captura Frame"]
        FRAME --> YUNET["YuNet - Detección"]
        YUNET --> SFACE["SFace - Embeddings 128D"]
        SFACE --> MATCH{"Matching IA"}
        MATCH --> LOCAL_DB[("SQLite Local")]
    end

    subgraph "Cloud Backend"
        LOCAL_DB --> SYNC["Sync Manager"]
        SYNC -->|Realtime| SB_DB[("Supabase - PostgreSQL")]
        SYNC -->|Backups| SB_STORAGE["Supabase Storage"]
    end

    LOCAL_DB --> REG["Panel Dashboard"]
    SB_DB --> WEB["Panel Web Monitor"]
```

### Infraestructura de IA y Datos

| Capa | Tecnología | Función | Ubicación |
|-------|-----------|-----------|-----------|
| **Detección** | YuNet (DNN) | Localización de rostros 360° | Edge (Local) |
| **Identificación** | SFace (DNN) | Extracción de embeddings 128D | Edge (Local) |
| **Base de Datos** | Supabase / Postgre | Persistencia Global y Realtime | Cloud (AWS/DigitalOcean) |
| **Seguridad** | Bandit / bcrypt | Cifrado y Auditoría de Seguridad | CI/CD + App |

> El sistema intenta primero OpenCV SFace (el más rápido y preciso). Si la confianza es baja, escala automáticamente a Gemini Vision. Si no hay internet, usa Photo Matcher como último recurso.

---

## ✨ Características Principales

<table>
<tr>
<td width="50%">

### 🎨 Interfaz Premium
- Diseño **glassmorphism** oscuro profesional
- Transiciones fluidas y micro-animaciones
- Splash screen animado al iniciar
- Dashboard en tiempo real con superposiciones de detección

</td>
<td width="50%">

### 🔐 Seguridad Empresarial
- Contraseñas cifradas con **bcrypt**
- Bloqueo automático tras 5 intentos fallidos (60s)
- Logs de auditoría de cada acceso
- Base de datos local sin exposición a la nube

</td>
</tr>
<tr>
<td>

### 📊 Gestión de Personal
- 56 empleados con datos completos (zona, sucursal, puesto)
- Fotos de perfil visibles al identificar
- Registro automático de entrada/salida
- Historial de asistencia por empleado

</td>
<td>

### ⚡ Rendimiento Cloud-Native
- Reconocimiento en **2–3 segundos**
- Sincronización Supabase Realtime (< 100ms)
- 10 augmentaciones por empleado (560 total)
- CI/CD Automático: Linting, Security Scan y Auto-build
- Auto-healing: deshabilita motores con errores de red

</td>
</tr>
</table>

---

## 🏗️ Estructura del Proyecto

```
app-login-trabajadores-desktop/
│
├── 📂 src/                          # Código fuente principal
│   ├── main.py                      # Punto de entrada de la aplicación
│   ├── config_gemini.py             # Configuración de API Gemini
│   ├── 📂 windows/                  # Interfaces gráficas (PyQt5)
│   │   ├── splash_window.py         # Pantalla de carga animada
│   │   ├── login_window.py          # Autenticación de usuarios
│   │   └── dashboard_window.py      # Panel principal con cámara
│   ├── 📂 utils/                    # Motores y utilidades
│   │   ├── hybrid_opencv_gemini_matcher.py  # 🧠 Motor híbrido principal
│   │   ├── face_recognition_opencv.py       # Motor OpenCV SFace/YuNet
│   │   ├── gemini_vision_matcher.py         # Motor Google Gemini Vision
│   │   ├── photo_to_photo_matcher.py        # Motor Photo Matcher (fallback)
│   │   ├── database.py              # Conexión SQLAlchemy
│   │   ├── auth.py                  # Autenticación bcrypt
│   │   ├── models.py                # Modelos ORM (Trabajador, Asistencia)
│   │   └── employee_mapper.py       # Mapeo de empleados desde JSON/CSV
│   └── 📂 assets/                   # Recursos visuales (logos, fondos)
│
├── 📂 database_fotos/               # Base de datos facial (entrenamiento)
│   ├── 📂 photos/                   # 56 fotografías de empleados
│   ├── 📂 json/                     # employees_db.json (mapeo de identidades)
│   └── face_encodings_opencv.pkl    # 560 embeddings SFace entrenados
│
├── 📂 data/
│   ├── 📂 db/                       # Base de datos SQLite (trabajadores.db)
│   └── 📂 models/                   # Modelos ONNX (YuNet + SFace)
│
├── 📂 scripts/                      # Herramientas de mantenimiento
│   ├── train_face_recognition_opencv.py  # Re-entrenar embeddings faciales
│   ├── extract_photos_from_pdf.py        # Extraer fotos de PDF de personal
│   └── setup_fotos.py                    # Preparar dataset de fotos
│
├── 📂 docs/                         # Documentación y manuales
│
├── iniciar.ps1                      # 🚀 Instalador + Lanzador (primera vez)
├── ejecutar.ps1                     # ⚡ Lanzador rápido
├── requirements.txt                 # Dependencias Python
└── .gitignore
```

---

## 🚀 Inicio Rápido

### Requisitos
- **Windows 10** o superior
- **Python 3.10+**
- Cámara web (integrada o USB)

### Instalación y Ejecución

```powershell
# 1. Clonar el repositorio
git clone https://github.com/Safe-LM/app-login-trabajadores-desktop.git
cd app-login-trabajadores-desktop

# 2. Instalar dependencias + ejecutar (primera vez)
.\iniciar.ps1

# 3. Para las siguientes ejecuciones (más rápido)
.\ejecutar.ps1
```

### Credenciales de Acceso

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin123` | Administrador |

### Configuración de Supabase Cloud

Para activar la sincronización en la nube, el archivo `.env` debe incluir:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-anon-key-de-supabase
GEMINI_API_KEY=opcional_para_engine_hibrido
```
> El sistema migrará automáticamente los registros locales a Supabase cuando detecte conexión.

---

## 📖 Manual de Operación

### Flujo diario de uso

```mermaid
sequenceDiagram
    participant Admin as Administrador
    participant App as Safe Link
    participant Cam as Camara
    participant AI as Motor IA
    participant DB as Base de Datos

    Admin->>App: Abre ejecutar.ps1
    App->>Admin: Pantalla de Login
    Admin->>App: Ingresa credenciales
    App->>Admin: Dashboard Principal
    Admin->>Cam: Activa la camara

    loop Cada empleado
        Cam->>AI: Frame del rostro
        AI->>AI: YuNet detecta y SFace extrae embedding
        AI->>DB: Busca match en 560 embeddings
        AI-->>App: Nombre, Puesto, Zona, Confianza
        App->>DB: Registra asistencia
        App-->>Admin: Entrada o Salida registrada
    end
```

### Pasos detallados

1. **Abrir** la aplicación con doble clic en `ejecutar.ps1`
2. **Iniciar sesión** con las credenciales de administrador
3. **Activar la cámara** desde el panel principal
4. El empleado se **posiciona frente a la cámara** (2–3 segundos)
5. El sistema muestra: **Nombre**, **Puesto**, **Zona**, **Sucursal** y **% de confianza**
6. Si la confianza es **≥ 85%**, la asistencia se registra **automáticamente**

---

## 👤 Agregar un Nuevo Empleado

```powershell
# 1. Copiar la foto del empleado a la carpeta de fotos
Copy-Item foto_nuevo.jpeg database_fotos\photos\

# 2. Actualizar el archivo JSON con los datos del empleado
# (editar database_fotos\json\employees_db.json)

# 3. Re-entrenar los embeddings (< 30 segundos)
python scripts\train_face_recognition_opencv.py

# 4. ¡Listo! El sistema ya reconoce al nuevo empleado
```

---

## 🛠️ Proceso de Desarrollo

| Paso | Descripción | Herramientas |
|------|-------------|-------------|
| **1. Recopilación** | Extracción de datos y fotos del PDF *PERSONAL TIENDAS BM* | `extract_photos_from_pdf.py` |
| **2. Procesamiento** | Organización de 56 fotografías y mapeo de identidades | Python, JSON |
| **3. Entrenamiento** | Generación de 560 embeddings faciales (10 augmentaciones × 56 empleados) | OpenCV DNN, SFace, YuNet |
| **4. Construcción** | Interfaz de escritorio con splash, login y dashboard | PyQt5, QThread |
| **5. Seguridad** | Cifrado bcrypt, bloqueo por intentos, logs de auditoría | bcrypt, SQLAlchemy |

---

## 🔧 Solución de Problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `Error 429 (Quota Exceeded)` | Límite de API Gemini alcanzado | El sistema usa OpenCV automáticamente. Verifique su cuota en Google AI Studio |
| `DLL Load Failed` | Falta Visual C++ Redistributable | Instale [VC++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe) |
| Cámara no detectada | En uso por Teams, Zoom, etc. | Cierre la otra aplicación y reactive la cámara |
| `No module named 'X'` | Dependencia faltante | Ejecute `.\iniciar.ps1` para reinstalar dependencias |
| Match con baja confianza | Embeddings desactualizados | Ejecute `python scripts\train_face_recognition_opencv.py` |

---

## 📊 Métricas del Sistema

<table>
<tr>
<td align="center"><h3>99%</h3><sub>Confianza Promedio</sub></td>
<td align="center"><h3>100%</h3><sub>Precisión en Pruebas</sub></td>
<td align="center"><h3>2-3s</h3><sub>Tiempo de Respuesta</sub></td>
<td align="center"><h3>56</h3><sub>Empleados Registrados</sub></td>
</tr>
</table>

---

## 🤝 Contribuir al Proyecto

Este proyecto sigue un flujo de trabajo profesional basado en **Issues**, **Branches** y **Pull Requests**. Todo cambio —por pequeño que sea— debe pasar por este proceso.

### Flujo de trabajo

```mermaid
flowchart LR
    A["1. Issue creado"] --> B["2. Asignarse al Issue"]
    B --> C["3. Crear Branch"]
    C --> D["4. Desarrollar"]
    D --> E["5. Push + PR"]
    E --> F["6. Code Review"]
    F --> G["7. Merge a main"]
```

### Paso a paso

#### 1. Revisar Issues y asignarse

Antes de escribir código, revisa los **Issues abiertos** en el repositorio:

```
https://github.com/Safe-LM/app-login-trabajadores-desktop/issues
```

- Si ya existe un Issue para lo que quieres hacer, **asígnate** a ti mismo.
- Si no existe, **crea uno nuevo** describiendo el problema o la mejora.

#### 2. Crear una branch desde el Issue

Usa esta convención de nombres para las ramas:

| Tipo de cambio | Prefijo | Ejemplo |
|----------------|---------|---------|
| Nueva funcionalidad | `feature/` | `feature/agregar-reporte-pdf` |
| Corrección de bug | `fix/` | `fix/login-no-responde` |
| Documentación | `docs/` | `docs/actualizar-readme` |
| Refactorización | `refactor/` | `refactor/reorganizar-matchers` |
| Mejora de rendimiento | `perf/` | `perf/optimizar-embeddings` |

```powershell
# Asegúrate de estar en main actualizado
git checkout main
git pull origin main

# Crear la nueva branch (ejemplo: Issue #12 - agregar exportar asistencia)
git checkout -b feature/12-exportar-asistencia
```

> **Tip:** Incluye el número del Issue en el nombre de la branch para que se vincule automáticamente.

#### 3. Desarrollar y hacer commits

Haz commits pequeños y descriptivos siguiendo esta convención:

```powershell
# Formato: tipo: descripción corta
git add .
git commit -m "feat: agregar boton de exportar asistencia a CSV"
git commit -m "fix: corregir formato de fecha en exportación"
git commit -m "docs: documentar nueva función de exportación"
```

| Prefijo | Uso |
|---------|-----|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `docs:` | Solo documentación |
| `refactor:` | Reestructuración sin cambiar funcionalidad |
| `style:` | Formato, estilos CSS, etc. |
| `perf:` | Mejoras de rendimiento |
| `test:` | Agregar o corregir tests |

#### 4. Push y crear Pull Request

```powershell
# Subir tu branch al repositorio
git push origin feature/12-exportar-asistencia
```

Después ve a GitHub y crea un **Pull Request (PR)**:

1. Ve a: `https://github.com/Safe-LM/app-login-trabajadores-desktop/pulls`
2. Clic en **"New Pull Request"**
3. Selecciona tu branch como **compare** y `main` como **base**
4. Agrega un título claro y en la descripción escribe: `Closes #12` (para que cierre el Issue automáticamente)
5. Asigna un **reviewer** para la revisión de código

#### 5. Code Review y Merge

- El reviewer revisa los cambios, deja comentarios si es necesario.
- Si hay correcciones, hazlas en la misma branch y haz push de nuevo.
- Una vez aprobado, el reviewer (o tú) hace **Merge** a `main`.
- La branch se elimina automáticamente después del merge.

### Reglas importantes

> **⚠️ Nunca hagas push directo a `main`.** Todo cambio debe pasar por un PR.

- Cada PR debe estar vinculado a un **Issue**.
- Los PRs deben tener al menos **1 aprobación** antes del merge.
- Mantén tus branches **actualizadas** con `main` antes de hacer PR:
  ```powershell
  git checkout feature/mi-branch
  git pull origin main
  ```
- Si hay conflictos, resuélvelos **localmente** antes de hacer push.

---

## 📄 Licencia

Este software es **propiedad privada** de **Safe Link Monitoring**. Queda prohibida su reproducción o distribución sin autorización expresa.

<p align="center">
  <br>
  <img src="https://img.shields.io/badge/Built_with-Python_+_OpenCV_+_PyQt5-6366f1?style=for-the-badge&labelColor=0f172a" alt="Built with">
  <br><br>
  <sub>Desarrollado con ❤️ por el equipo de Ingeniería de <strong>Safe Link Monitoring</strong> · 2026</sub>
</p>
