# Safe Link Station

> Estación on-premise de control de asistencia con reconocimiento facial.
> Python 3.10 · PyQt5 · OpenCV DNN (YuNet + SFace) · React UI embebida · Supabase

---

## Para qué sirve

Es la app que se instala en cada PC con cámara dentro de la sucursal del cliente. Reconoce al empleado por la cara, registra su entrada/salida en la base local SQLite y la sube en tiempo real a Supabase. Si se cae internet, sigue funcionando offline y sincroniza cuando vuelve.

| Función | Detalle |
|---|---|
| **Reconocimiento facial** | OpenCV DNN — YuNet (detección) + SFace (embeddings 128D) — ~99% precisión con 10 embeddings/empleado |
| **Sincronización** | Heartbeat cada 60s + sync embeddings cada 4h + offline queue de asistencias |
| **UI kiosco** | React + Vite embebido en `QWebEngineView`, full-screen, sin barra de tareas |
| **Realtime** | Escucha comandos del panel web vía Supabase Realtime |
| **Provisioning** | Zero-touch via QR o pareo manual con código de 6 dígitos |

---

## Requisitos

- **Windows 10/11** (desarrollo y producción)
- **Python 3.10+** ([descarga](https://www.python.org/downloads/release/python-31011/))
- **Node 20+** (para compilar el frontend React)
- **Cámara USB o webcam** funcional
- **Conexión a internet** (la primera vez para sincronizar empleados)

---

## Instalación

```powershell
# 1. Clonar el repo
git clone https://github.com/Safe-LM/app-login-trabajadores-desktop.git
cd app-login-trabajadores-desktop\station

# 2. Crear entorno virtual e instalar dependencias
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Compilar frontend React (genera frontend/dist/)
cd frontend
npm install
npm run build
cd ..

# 4. Descargar modelos de IA (~12 MB)
python download_models.py

# 5. Configurar credenciales
copy .env.example .env
# Editar .env con SUPABASE_URL y STATION_API_KEY
```

### Setup automático (un solo comando)

```powershell
.\setup_station.bat
```

---

## Uso

### Producción (modo kiosco)

```powershell
python run_station.py
```

Abre la app en pantalla completa, activa la cámara, sincroniza con Supabase y queda esperando rostros.

### Desarrollo (con hot reload del frontend)

```powershell
python run_station.py dev
```

Levanta Vite en `localhost:5173` y Python carga la UI desde ahí. Cambios en React se reflejan al instante sin recompilar.

### Recompilar solo el frontend

```powershell
python run_station.py build
```

---

## Configuración (`.env`)

```env
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_KEY=<anon_key>
STATION_API_KEY=<api_key_del_dispositivo>
STATION_NAME=Sucursal-Centro-1
```

> El `STATION_API_KEY` se genera al crear la estación desde el panel web. Si no lo configuras, la app entra en **modo provisioning** y muestra un código QR para parear con el panel.

---

## Estructura interna

```
station/
├── run_station.py          # Entry point (prod | dev | build)
├── setup_station.bat       # Setup automatico Windows
├── build_station.bat       # Build .exe con PyInstaller
├── download_models.py      # Descarga YuNet + SFace
├── requirements.txt
├── src/
│   ├── main.py             # Bootstrap PyQt5 + dashboard
│   ├── windows/
│   │   ├── dashboard_window.py    # Ventana kiosco principal
│   │   ├── login_window.py
│   │   ├── setup_window.py
│   │   ├── enrollment_window.py
│   │   └── activation_window.py
│   ├── utils/
│   │   ├── face_recognition_opencv.py    # YuNet + SFace
│   │   ├── hybrid_opencv_gemini_matcher.py  # Fallback con Gemini
│   │   ├── photo_to_photo_matcher.py
│   │   ├── sync_manager.py        # Sync nube ↔ local
│   │   ├── realtime_listener.py   # Supabase Realtime
│   │   ├── station_manager.py     # Heartbeat + StationInfo
│   │   ├── supabase_client.py
│   │   ├── database.py            # SQLite local
│   │   ├── models.py              # SQLAlchemy ORM
│   │   ├── auth.py
│   │   ├── hwid.py                # Hardware fingerprint
│   │   └── auto_updater.py
│   ├── services/                  # Capa de servicios (DTOs, casos de uso)
│   ├── repositories/              # Capa de datos
│   └── ui/                        # Widgets PyQt reutilizables
├── frontend/                      # React + Vite (UI embebida)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/bridge.ts          # QWebChannel ↔ Python
│   │   └── store/useStore.ts      # Zustand
│   └── dist/                      # Build (servida por QWebEngineView)
├── data/
│   ├── db/trabajadores.db         # SQLite local (no va a git)
│   └── cache/<empresa_id>/        # Fotos + embeddings (no va a git)
└── tests/
    ├── test_unit/
    └── test_integration/
```

---

## Cómo funciona el reconocimiento

```
┌──────────┐   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
│  Cámara  │──▶│ YuNet detect │──▶│ SFace embedding│──▶│ Cosine match │
│ 30 fps   │   │  cara/frame  │   │   128 floats   │   │  vs cache    │
└──────────┘   └──────────────┘   └────────────────┘   └──────────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │ ¿confianza >= 0.85?  │
                                                   ├──────────────────────┤
                                                   │ Sí → registrar       │
                                                   │ No → seguir buscando │
                                                   └──────────────────────┘
```

### Sync automático con Supabase

Al arrancar:
1. **Heartbeat** → Supabase responde con `empresa_id` y nombre de la estación
2. **Descarga lista de empleados** vía RPC `get_empleados_empresa`
3. **Descarga fotos faltantes** desde Storage (`fotos-empleados/<empresa>/<empleado>.jpg`)
4. **Genera 10 embeddings/empleado** con data augmentation v3 (rotaciones, brillo, blur)
5. **Sube embeddings** a Supabase vía RPC `subir_embeddings_estacion_batch`
6. **Marca empleados como enrollados** (`enrollado = true`)

Cada 60s vuelve a hacer heartbeat. Cada 4h re-sincroniza embeddings (idempotente).

---

## Empaquetado a `.exe`

```powershell
.\build_station.bat
```

Usa PyInstaller para generar `dist/SafeLinkStation.exe` con:
- Modelos ONNX embebidos
- Frontend React compilado
- Sin consola visible (`--noconsole`)

El **GitHub Action `station-build-windows.yml`** hace esto automáticamente al pushear un tag `station-v*`:

```bash
git tag station-v5.0.0
git push origin station-v5.0.0
# → GitHub Actions compila el .exe y lo publica como release asset
```

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `ImportError: QtWebEngineWidgets must be imported before QApplication` | Tu `main.py` está desactualizado — `git pull origin main` |
| `Could not find function subir_embeddings_estacion_batch` | Falta aplicar migración → `tools/migration/run_supabase_migration.py` |
| `Encodings cargados: 0 (0 empleados)` | El caché está vacío. Borra `station/data/cache/` y reinicia para forzar re-sync |
| `Camera not found` | Verifica que ningún otro proceso (Teams, Zoom) esté usando la cámara |
| La estación no aparece en el panel | El heartbeat falla — revisa `SUPABASE_URL` y `STATION_API_KEY` en `.env` |
| `face_recognition no disponible (opcional)` | Es solo un warning, el matcher OpenCV cubre todo. Ignorar |

### Reset completo (cuando algo se rompe feo)

```powershell
.\debug_reset.bat
```

Borra caché, base local y vuelve al estado de fábrica (mantiene `.env`).

---

## Tests

```powershell
.\venv\Scripts\Activate.ps1
pytest tests/ -v
```

CI corre `pytest-qt` con `QT_QPA_PLATFORM=offscreen` en cada push a `main` (workflow `station-tests.yml`).

---

## Logs

La app loga a stdout. Para guardar a archivo:

```powershell
python run_station.py 2>&1 | Tee-Object -FilePath logs\station_$(Get-Date -Format yyyyMMdd_HHmmss).log
```

Logs importantes en Supabase: tabla `logs_estacion` (insertados via RPC `insertar_log_estacion`).

---

## Performance

| Métrica | Valor típico |
|---|---|
| Latencia detección + match | 80–150 ms (CPU sin GPU) |
| Confianza promedio (con foto buena) | 92–99% |
| RAM en runtime | ~250 MB |
| Tamaño del `.exe` | ~180 MB (incluye Qt + modelos) |
| Embeddings por empleado | 10 (data augmentation) |

---

## Recursos relacionados

- [Arquitectura general (`docs/arquitectura.md`)](../docs/arquitectura.md)
- [Runbook de la estación (`docs/runbook-estacion.md`)](../docs/runbook-estacion.md)
- [Entrenamiento facial (`docs/entrenamiento-facial.md`)](../docs/entrenamiento-facial.md)
- [README general del proyecto](../README.md)
