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

### Variables obligatorias

```env
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_KEY=<anon_key>
STATION_API_KEY=<api_key_del_dispositivo>
STATION_NAME=Sucursal-Centro-1
```

> El `STATION_API_KEY` se genera al crear la estación desde el panel web. Si no lo configuras, la app entra en **modo provisioning** y muestra un código QR para parear con el panel.

### Variables opcionales

| Variable | Default | Qué hace |
|---|---|---|
| `STATION_DEV` | `0` | Si `=1`, carga la UI desde `localhost:5173` (Vite dev server) en lugar de `frontend/dist/`. Útil para hot reload del frontend. |
| `STATION_BEEP_ON_SUCCESS` | `true` | Reproduce 3 tonos ascendentes via `winsound` al confirmar asistencia. Set a `false` para entornos donde el ruido sea molesto (oficinas silenciosas). |
| `STATION_AUTO_CLOSE` | `true` | Cierra la app completa 4s después de un fichaje exitoso. Evita re-fichado accidental. Set a `false` para modo kiosko continuo (atiende fila sin cerrar entre empleados). |
| `STATION_ENABLE_PHOTO_MATCHER` | `false` | Re-habilita el matcher legacy HOG (`photo_to_photo_matcher.py`). Desactivado por default — generaba falsos positivos con embeddings modernos. Solo para tests. |
| `AUTO_UPDATE_ENABLED` | `true` | Verifica si hay nueva versión en GitHub Releases al arrancar. |

### Ubicación del `.env`

| Contexto | Ruta del `.env` |
|---|---|
| Dev local (`python run_station.py`) | `station/.env` (en el repo) |
| `.exe` instalado en Windows | `%LOCALAPPDATA%\Safe Link Station\.env` |

El instalador NSIS copia el `.env` plantilla al `%LOCALAPPDATA%` la primera vez.

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
│   │   ├── face_recognition_opencv.py    # YuNet + SFace — motor PRINCIPAL
│   │   ├── hybrid_opencv_gemini_matcher.py  # Wrapper sobre OpenCV (Gemini desactivado)
│   │   ├── photo_to_photo_matcher.py  # Matcher legacy HOG (deshabilitado por default)
│   │   ├── sync_manager.py        # Sync nube ↔ local + auto-healing pkl
│   │   ├── realtime_listener.py   # Supabase Realtime para comandos
│   │   ├── station_manager.py     # Heartbeat + StationInfo
│   │   ├── supabase_client.py
│   │   ├── database.py            # SQLite local (init_db + auto-migration)
│   │   ├── models.py              # SQLAlchemy ORM (Trabajador, RegistroAsistencia)
│   │   ├── paths.py               # writable_root + bundled_models_root (--onedir aware)
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
│ ~30 fps  │   │  cara/frame  │   │   128 floats   │   │  vs cache    │
└──────────┘   └──────────────┘   └────────────────┘   └──────────────┘
                                                              │
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │ ¿cosine >= 0.40?     │
                                                   │ + gap >= 0.03 vs 2do │
                                                   │ + quality gate ok    │
                                                   ├──────────────────────┤
                                                   │ Sí → auto-registrar  │
                                                   │ No → seguir buscando │
                                                   └──────────────────────┘
```

**Threshold de auto-registro:** `AUTO_REGISTER_THRESHOLD = 0.40` (cosine raw).
Coincide con el `MIN_COSINE` del matcher: si el recognizer ya validó que es
la misma persona (pasó threshold + gap + quality gate), el registro persiste
sin requerir confianza extra. La protección anti-duplicado (60s entre fichajes
del mismo empleado) evita registros accidentales.

> Nota: versiones anteriores usaban 0.50, pero generaba la confusión
> "dice IDENTIFICADO pero no me ficha" cuando el match legítimo caía en
> 0.42–0.49. Ahora ambos thresholds son consistentes.

### Bbox en vivo

Sobre el feed de la cámara se dibujan marcas estilo *viewfinder* (corners
verdes) alrededor del rostro detectado por YuNet. Feedback visual inmediato
al empleado: ve dónde está mirando el sistema y si su cara está bien
encuadrada.

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

| Síntoma | Diagnóstico / solución |
|---|---|
| **UI dice "IDENTIFICADO" pero no registra asistencia** | Verifica que la confianza supere `AUTO_REGISTER_THRESHOLD=0.40`. Si está por debajo, el match se muestra pero no persiste. Mejora luz o calidad de la foto enrollada. |
| **Status queda en "SISTEMA LISTO" eternamente** | El thread de reconocimiento no arrancó. Revisa en panel: `recognition_init` debe tener `available=true`. Si dice `false`, falta el modelo DNN en el bundle (build mal hecho). |
| **`No such table: trabajadores`** en log | `init_db()` falló. Borrar `<writable_root>/data/db/trabajadores.db` y reiniciar — la auto-migration la recrea. |
| **`Modelos DNN no encontrados`** | Solo en dev local: corre `python download_models.py`. En `.exe` instalado los modelos vienen bundleados en `_internal/models/` — si faltan, el build se hizo mal (revisa `SafeLink_Station.spec`). |
| **`Encodings cargados: 0 (0 empleados)`** | El caché está vacío. Borra `<writable_root>/data/cache/` y reinicia para forzar re-sync desde Supabase. |
| **`Camera not found` / cámara congelada** | Verifica que ningún otro proceso (Teams, Zoom, OBS) esté usando la cámara. El `_CameraThread` tiene watchdog que reabre si detecta frames congelados. |
| **La estación no aparece en el panel** | Heartbeat falla — revisa `SUPABASE_URL` y `STATION_API_KEY` en `.env`. Si la api_key fue revocada desde el panel, hay que re-provisioning. |
| **`ImportError: QtWebEngineWidgets must be imported before QApplication`** | `main.py` desactualizado — `git pull origin main`. |
| **Beep no suena** | Verifica `STATION_BEEP_ON_SUCCESS=true` y que el sistema tenga audio activo. Es no-bloqueante (corre en thread daemon). |
| **App no cierra entre fichajes (modo single-user)** | Set `STATION_AUTO_CLOSE=true` en `.env` para cerrar tras cada registro. Default `false` = modo kiosko continuo. |
| **AudioContext warnings spameando consola** | Cosmético — Chrome embebido bloquea audio en kiosko sin gesto del usuario. Ya silenciado a nivel Python en el filtro `_js_console`. El beep real usa `winsound` (no web audio). |

### Diagnóstico remoto (desde el panel)

Para una estación en producción sin acceso físico, consulta los eventos
`recognition_*` en `logs_estacion` (sección [Telemetría remota](#telemetría-remota-panel)).
La métricas `brillo`, `std`, `lap` de cada intento permiten saber si el
problema es iluminación, blur, o el motor de matching.

### Reset completo (cuando algo se rompe feo)

```powershell
.\debug_reset.bat
```

Borra caché, base local y vuelve al estado de fábrica (mantiene `.env`).
En el `.exe` instalado: borrar manualmente
`%LOCALAPPDATA%\Safe Link Station\data\` y reiniciar la app.

---

## Tests

```powershell
.\venv\Scripts\Activate.ps1
pytest tests/ -v
```

CI corre `pytest-qt` con `QT_QPA_PLATFORM=offscreen` en cada push a `main` (workflow `station-tests.yml`).

---

## Logs

### Log local

La app escribe a `<writable_root>/logs/station.log` (en `.exe` instalado:
`%LOCALAPPDATA%\Safe Link Station\logs\station.log`). En dev local va a
stdout y también a `station/logs/station.log`.

Para guardar stdout adicional a un archivo con timestamp:

```powershell
python run_station.py 2>&1 | Tee-Object -FilePath logs\station_$(Get-Date -Format yyyyMMdd_HHmmss).log
```

### Telemetría remota (panel)

La estación sube eventos en tiempo real a `logs_estacion` en Supabase vía
RPC `insertar_log_estacion`. Permite debuguear "no detecta" o "no registra"
sin acceso físico al kiosko.

| Evento | Cuándo se emite | Payload relevante |
|---|---|---|
| `recognition_init` | Dashboard crea el thread de reconocimiento | `available`, `has_init_fn` |
| `recognition_unavailable` | Motor no se pudo cargar (DNN no encontrado) | — |
| `recognition_ready` | `inicializar_sistema_facial()` terminó OK | — |
| `recognition_init_error` | Excepción en init | `error` |
| `recognition_thread_started` | Loop de reconocimiento arrancó | `interval` |
| `recognition_match` | Match exitoso (cualquier intento) | `method`, `conf`, `empleado`, `brillo`, `std`, `lap` |
| `recognition_no_match` | Sin match (cada 5 intentos para no saturar) | `attempt`, `hybrid_conf`, `opencv_conf`, `brillo`, `std`, `lap` |
| `recognition_error` | Excepción procesando un intento | `attempt`, `error` |
| `recognition_thread_stopped` | Loop detenido (cierre o stop) | `total_attempts` |
| `enrollment_no_bbox` | Foto no tenía cara detectable al regenerar embeddings | `empleado_id`, `fallback` |
| `sync_ok` / `sync_error` | Sincronización completada o fallida | `empleados`, `embeddings_nuevos` |
| `embeddings_download_*` | Descarga de embeddings desde Supabase | `embeddings`, `parse_errors` |

Cómo consultar desde el panel admin: tabla `logs_estacion` en Supabase, o
sección "Logs en vivo" del panel de cada estación. Filtros típicos:

```sql
-- ¿Por qué no detecta a un empleado?
SELECT tipo, detalle, creado_en
FROM logs_estacion
WHERE creado_en > now() - interval '5 minutes'
  AND tipo LIKE 'recognition%'
ORDER BY creado_en DESC;
```

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
