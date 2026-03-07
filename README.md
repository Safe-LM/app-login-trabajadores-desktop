<p align="center">
  <img src="https://img.shields.io/badge/Safe%20Link-Monitoring-6366f1?style=for-the-badge&labelColor=1e293b" alt="Safe Link Monitoring">
</p>

<h1 align="center">Control de Asistencia — Reconocimiento Facial</h1>

<p align="center">
  <strong>Aplicación de escritorio para registro de entrada y salida de trabajadores mediante reconocimiento facial en tiempo real</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/PyQt5-5.15-41CD52?style=flat-square&logo=qt&logoColor=white" alt="PyQt5">
  <img src="https://img.shields.io/badge/OpenCV-4.8-5C3EE8?style=flat-square&logo=opencv&logoColor=white" alt="OpenCV">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-64748b?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Version-2.0.4-22c55e?style=flat-square" alt="Version">
</p>

<p align="center">
  <a href="#-descripción">Descripción</a> •
  <a href="#-características">Características</a> •
  <a href="#-instalación-rápida">Instalación</a> •
  <a href="#-uso">Uso</a> •
  <a href="#-proceso-de-desarrollo">Proceso</a> •
  <a href="#-arquitectura">Arquitectura</a> •
  <a href="#-solución-de-problemas">Ayuda</a>
</p>

---

## 📋 Descripción

**Control de Asistencia** es una aplicación de escritorio desarrollada por **Safe Link Monitoring** para automatizar el registro de entrada y salida del personal mediante **reconocimiento facial en tiempo real**. Diseñada para integración con el ecosistema Safe Link (monitoreo de cámaras, dashboards web y gestión centralizada).

### ¿Por qué usar esta aplicación?

- **Sin contacto** — Registro biométrico sin necesidad de tarjetas ni huellas
- **Precisión** — Múltiples motores de reconocimiento (OpenCV, Gemini Vision, híbridos)
- **Tiempo real** — Identificación instantánea al mirar la cámara
- **Integración** — Compatible con bases de datos y APIs del ecosistema Safe Link

---

## ✨ Características

### Interfaz y experiencia

| Característica | Detalle |
|----------------|---------|
| **UI moderna** | PyQt5 con tema oscuro, diseño limpio y responsive |
| **Splash screen** | Pantalla de carga durante la inicialización |
| **Login seguro** | Autenticación con bcrypt y sesiones |
| **Dashboard** | Vista unificada: cámara en vivo, registro y estado de asistencia |

### Motores de reconocimiento facial

| Motor | Descripción | Requisitos |
|-------|-------------|------------|
| **OpenCV** | Detección y comparación local, rápido y offline | Ninguno |
| **Gemini Vision** | IA de Google para mayor precisión en condiciones difíciles | API Key |
| **Híbrido** | Combina foto de perfil vs captura de cámara para validación cruzada | API Key (opcional) |

### Funcionalidades técnicas

- Registro automático de **entrada** y **salida** con timestamp
- Base de datos con **SQLAlchemy** (SQLite, PostgreSQL, MySQL)
- Soporte para **múltiples empleados** y fotos de referencia
- **Entrenamiento de modelos** locales para mejorar precisión
- Opcional: modelos avanzados con **PyTorch/Ultralytics** (YOLO, etc.)

---

## 🚀 Instalación rápida

### Requisitos previos

- **Python** 3.8 o superior
- **Cámara web** (integrada o USB)
- **Sistema operativo:** Windows 10/11, Linux o macOS

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Safe-LM/app-login-trabajadores-desktop.git
cd app-login-trabajadores-desktop

# 2. Crear entorno virtual (recomendado)
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Windows (CMD) / Linux / macOS
# venv\Scripts\activate     (Windows)
# source venv/bin/activate  (Linux/macOS)

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar
python main.py
```

### Configuración opcional (Gemini Vision)

Para usar reconocimiento con IA de Google, crea un archivo `.env` en la raíz:

```env
GEMINI_API_KEY=tu_api_key_aqui
```

O define la variable de entorno:

```powershell
# Windows PowerShell
$env:GEMINI_API_KEY = "tu_api_key_aqui"
```

```bash
# Linux / macOS
export GEMINI_API_KEY="tu_api_key_aqui"
```

---

## 📖 Uso

### Flujo de la aplicación

```
[Splash] → [Login] → [Dashboard] → [Registro facial]
```

1. **Inicio** — Se muestra el splash mientras se cargan los módulos
2. **Login** — Credenciales por defecto: `empleado` / `empleado123` (cambiar en producción)
3. **Dashboard** — Activa la cámara y posiciona tu rostro frente a ella
4. **Registro** — El sistema identifica tu rostro y registra entrada o salida automáticamente

### Crear ejecutable (PyInstaller)

Para distribuir la aplicación sin Python instalado:

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name "SafeLink-Asistencia" main.py
```

El ejecutable se genera en `dist/`.

---

## 📐 Proceso de desarrollo (paso a paso)

> 📄 **Documentación ejecutiva:** Se generó documentación en PDF (ideal para presentar a dirección) a partir del proceso descrito en LaTeX:
> - **[`docs/documentacion_ejecutiva_app_login_trabajadores.pdf`](docs/documentacion_ejecutiva_app_login_trabajadores.pdf)** — Resumen no técnico, paso a paso (generado para dirección)
> - **`docs/PROCESO_DESARROLLO_APP_CORTO.tex`** — Fuente LaTeX con detalle técnico completo

### ¿Cómo se hizo? (Resumen ejecutivo)

| Paso | Descripción |
|------|-------------|
| **1. Recopilar información** | Se partió del PDF interno de la empresa (PERSONAL TIENDAS BM) con la tabla de trabajadores: nombre, zona, sucursal, puesto y fotografía. |
| **2. Extraer fotos y datos** | Se extrajeron las 56 fotografías del PDF y se organizaron en carpeta. Cada foto se vinculó con los datos del empleado en un archivo JSON. |
| **3. "Enseñarle" al sistema** | Se usó un modelo de reconocimiento facial (SFace DNN) que genera una "huella facial" única por persona. De cada foto se crearon 10 variaciones (brillo, ángulos, etc.) para mayor precisión. **Resultado:** 560 huellas (56 × 10). **Precisión: 100%** en pruebas. |
| **4. Desarrollar la aplicación** | Tres pantallas: Splash de carga → Login (usuario/contraseña) → Dashboard con cámara en vivo y registro automático. |
| **5. Proteger la seguridad** | Contraseñas cifradas (bcrypt), bloqueo tras 5 intentos fallidos (60 s), umbral mínimo de confianza para evitar fotos impresas. |

### Evolución técnica del reconocimiento facial

| Versión | Precisión | Confianza | Enfoque |
|---------|-----------|-----------|---------|
| v1: Histogramas/LBP | 30.4% | 83–87% | Features genéricos de imagen |
| v2: HOG multi-escala | ~30% | 81–86% | Augmentation + HOG a 3 resoluciones |
| **v3: SFace DNN** | **100%** | **99%** | Redes neuronales (YuNet + SFace del OpenCV Zoo) |

La versión final usa **YuNet** (detección de rostros) y **SFace** (embeddings de 128 dimensiones). La clave: SFace codifica *la identidad del rostro*, no solo la imagen — por eso el salto de 30% a 100%.

**Pipeline en tiempo real** (cuando la cámara captura un frame):
1. YuNet detecta el rostro y sus landmarks
2. SFace genera el embedding de 128D
3. Se calcula similitud coseno contra los 560 embeddings almacenados
4. Voting: se agrupan por empleado y se promedian los top-5
5. Si supera el umbral con suficiente separación del segundo candidato → se confirma la identidad

Sistema híbrido con fallback: **OpenCV (principal)** → **Gemini API (opcional)** → **Haar Cascade (fallback)**.

### Cómo funciona en el día a día

1. Se abre la aplicación (doble clic en el acceso directo).
2. El administrador inicia sesión con usuario y contraseña.
3. Se activa la cámara desde el panel principal.
4. Cada empleado se para frente a la cámara unos segundos.
5. El sistema muestra: nombre, puesto, zona, sucursal y nivel de confianza.
6. Si la confianza es **> 85%**, se registra la asistencia automáticamente.
7. Queda guardado: fecha, hora y quién fue reconocido.

### Datos clave

| Concepto | Detalle |
|----------|---------|
| Empleados registrados | 56 |
| Precisión del reconocimiento | 100% |
| Confianza promedio | 99% |
| Tiempo de reconocimiento | 2–3 segundos |
| ¿Se necesita internet? | No (funciona offline) |
| Datos por registro | Nombre, fecha, hora, confianza |

### ¿Qué se necesita para usarlo?

- Computadora con **Windows 10** o superior
- **Cámara web** (la integrada del laptop funciona)
- La aplicación instalada (ya lista para usarse)

### ¿Qué pasa si se agrega un nuevo empleado?

1. Se agrega su foto a la carpeta de fotos.
2. Se actualizan sus datos en el archivo de empleados (`employees_db.json`).
3. Se ejecuta el entrenamiento: `python train_face_recognition_opencv.py` (tarda < 30 s).
4. Listo: el sistema ya lo reconoce.

---

## 🏗 Arquitectura

### Estructura del proyecto

```
app-login-trabajadores-desktop/
├── main.py                          # Punto de entrada
├── config_gemini.py                 # Configuración API Gemini
├── train_face_recognition_opencv.py # Entrenamiento de modelos
├── requirements.txt
├── docs/                            # Documentación PDF y LaTeX
├── windows/
│   ├── splash_window.py             # Pantalla de carga
│   ├── login_window.py              # Ventana de login
│   └── dashboard_window.py          # Dashboard con cámara y registro
├── utils/
│   ├── auth.py                      # Autenticación
│   ├── employee_mapper.py           # Mapeo de empleados
│   ├── face_recognition_opencv.py   # Motor OpenCV
│   ├── gemini_vision_matcher.py     # Motor Gemini Vision
│   ├── hybrid_opencv_gemini_matcher.py
│   ├── photo_to_photo_matcher.py
│   └── process_photos.py
├── main_codes/                      # Scripts de entrenamiento y pruebas
└── _archivo/                        # Documentación y scripts legacy
```

### Stack tecnológico

| Tecnología | Uso |
|------------|-----|
| **PyQt5** | Interfaz gráfica |
| **OpenCV** | Captura de cámara, detección facial |
| **SQLAlchemy** | ORM y persistencia |
| **NumPy / Pandas** | Procesamiento de datos |
| **bcrypt** | Hash de contraseñas |
| **Google Gemini** | Reconocimiento facial con IA (opcional) |
| **PyTorch / Ultralytics** | Modelos avanzados (opcional) |

---

## 🔧 Solución de problemas

| Problema | Solución |
|----------|----------|
| **No se accede a la cámara** | Cierra otras aplicaciones que usen la cámara. Revisa permisos del sistema operativo. |
| **Reconocimiento no disponible** | Verifica que los modelos estén entrenados y la ruta de fotos de empleados sea correcta. |
| **Error de Gemini** | Comprueba que `GEMINI_API_KEY` esté definida en `.env` o variables de entorno. |
| **Dependencias faltantes** | Ejecuta `pip install -r requirements.txt` de nuevo. |
| **Error al activar venv (Windows)** | Ejecuta `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` en PowerShell. |
| **PyQt5 no se importa** | Asegúrate de estar dentro del entorno virtual y de haber instalado las dependencias. |

---

## 📄 Licencia

Proyecto propietario de **Safe Link Monitoring**. Uso interno y bajo autorización.

---

<p align="center">
  <sub>Desarrollado por <strong>Safe Link Monitoring</strong></sub>
</p>
