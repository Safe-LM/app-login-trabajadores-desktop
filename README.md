# Safe Link Monitoring — Control de Asistencia

<p align="center">
  <strong>Aplicación de escritorio para reconocimiento facial de trabajadores</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/PyQt5-5.15-41CD52?style=flat&logo=qt&logoColor=white" alt="PyQt5">
  <img src="https://img.shields.io/badge/OpenCV-4.8-5C3EE8?style=flat&logo=opencv&logoColor=white" alt="OpenCV">
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License">
</p>

---

## Descripción

**Safe Link Monitoring - Control de Asistencia** es una aplicación de escritorio desarrollada para **Safe Link Monitoring** que permite el registro de entrada y salida de trabajadores mediante **reconocimiento facial en tiempo real**. Integra múltiples motores de reconocimiento (OpenCV, Gemini Vision, híbridos) para mayor precisión y confiabilidad.

### Características principales

| Característica | Descripción |
|----------------|-------------|
| **Interfaz moderna** | UI con PyQt5, tema oscuro y diseño profesional |
| **Reconocimiento facial** | OpenCV, Gemini Vision o híbrido (foto vs cámara) |
| **Control de asistencia** | Registro automático de entrada/salida con timestamp |
| **Base de datos** | SQLAlchemy, compatible con el ecosistema Safe Link |
| **Splash y login** | Flujo de inicio con splash screen y autenticación |
| **Multiplataforma** | Windows, Linux y macOS |

---

## Requisitos del sistema

- **Python** 3.8 o superior
- **Cámara web** (integrada o USB)
- **Sistema operativo:** Windows 10/11, Linux o macOS

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/SafeLink-Monitoring/app-login-trabajadores-desktop.git
cd app-login-trabajadores-desktop
```

### 2. Crear entorno virtual (recomendado)

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno (opcional)

Para usar **Gemini Vision** como motor de reconocimiento, crea un archivo `.env` en la raíz:

```
GEMINI_API_KEY=tu_api_key_aqui
```

O configura la variable de entorno:

```bash
set GEMINI_API_KEY=tu_api_key_aqui    # Windows
export GEMINI_API_KEY=tu_api_key_aqui # Linux/macOS
```

### 5. Ejecutar la aplicación

```bash
python main.py
```

---

## Uso

1. **Inicio:** Se muestra el splash screen y luego la ventana de login.
2. **Login:** Ingresa usuario y contraseña (por defecto: `empleado` / `empleado123`).
3. **Dashboard:** Activa la cámara y registra tu asistencia con reconocimiento facial.
4. **Registro:** El sistema identifica tu rostro y registra entrada o salida automáticamente.

---

## Estructura del proyecto

```
app-login-trabajadores-desktop/
├── main.py                      # Punto de entrada
├── config_gemini.py             # Configuración API Gemini
├── train_face_recognition_opencv.py  # Entrenamiento de modelos
├── requirements.txt
├── windows/
│   ├── splash_window.py         # Pantalla de carga
│   ├── login_window.py         # Ventana de login
│   └── dashboard_window.py     # Dashboard con cámara y registro
├── utils/
│   ├── auth.py                  # Autenticación
│   ├── employee_mapper.py       # Mapeo de empleados
│   ├── face_recognition_opencv.py
│   ├── gemini_vision_matcher.py
│   ├── hybrid_opencv_gemini_matcher.py
│   ├── photo_to_photo_matcher.py
│   └── process_photos.py
├── main_codes/                  # Scripts de entrenamiento y pruebas
└── _archivo/                    # Documentación y scripts legacy
```

---

## Tecnologías

- **PyQt5** — Interfaz gráfica
- **OpenCV** — Captura de cámara y procesamiento de imágenes
- **SQLAlchemy** — ORM y base de datos
- **NumPy / Pandas** — Procesamiento de datos
- **Google Gemini** (opcional) — Reconocimiento facial con IA
- **PyTorch / Ultralytics** (opcional) — Modelos avanzados

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| No se accede a la cámara | Cierra otras apps que usen la cámara y revisa permisos del sistema |
| Reconocimiento no disponible | Verifica que los modelos estén entrenados y la ruta de fotos sea correcta |
| Error de Gemini | Comprueba `GEMINI_API_KEY` en `.env` o variables de entorno |
| Dependencias faltantes | Ejecuta `pip install -r requirements.txt` de nuevo |

---

## Versión

**v2.0.4** — Safe Link Monitoring

---

## Licencia

Proyecto propietario de **Safe Link Monitoring**. Uso interno.

---

<p align="center">
  <sub>Desarrollado por Safe Link Monitoring</sub>
</p>
