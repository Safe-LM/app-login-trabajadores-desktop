# Installer NSIS — Safe Link Station

Genera el `.exe` instalable que reciben los clientes.

## Cómo se compila (manual, en una máquina Windows)

1. Construir el bundle de PyInstaller:
   ```powershell
   cd station
   pyinstaller SafeLink_Station.spec --noconfirm
   ```
   Esto deja todo en `station/dist/SafeLink_Station/`.

2. Compilar el frontend React (si no se hizo antes):
   ```powershell
   cd frontend
   npm ci
   npm run build
   ```

3. Compilar el instalador con NSIS:
   ```powershell
   cd ..\installer
   makensis installer.nsi
   ```
   Genera `SafeLinkStation_Setup_X.Y.Z.exe` en la misma carpeta.

## Cómo se compila automáticamente

El workflow `.github/workflows/station-installer.yml` hace todo lo
anterior cuando release-please publica un release tras mergear su PR:

```
# Flujo completo (automático):
git push origin main  ─▶  release-please abre PR
                        └─▶ mergeas PR  ─▶  tag station-vX.Y.Z + release
                                          └─▶ station-installer.yml ejecuta
                                              ├─▶ PyInstaller --onedir
                                              ├─▶ Vite build
                                              ├─▶ NSIS makensis
                                              └─▶ sube .exe al release
```

GitHub Actions:
1. Compila PyInstaller en modo `--onedir` (output en `dist/SafeLink_Station/`)
2. Compila Vite (frontend React → `frontend/dist/index.html` single-file)
3. Instala NSIS y compila el instalador
4. Sube `SafeLinkStation_Setup_X.Y.Z.exe` a GitHub Releases (con SHA256SUMS)
5. El auto-updater de las estaciones detecta la nueva versión y la propone

## Estructura del `.exe` instalado

NSIS instala en `C:\Program Files\Safe Link Station\`:

```
Safe Link Station/
├── SafeLink_Station.exe        # Entry point (PyInstaller stub)
├── Uninstall.exe
└── _internal/                  # Bundle PyInstaller (read-only)
    ├── base_library.zip
    ├── models/                 # YuNet + SFace ONNX
    │   ├── face_detection_yunet_2023mar.onnx
    │   └── face_recognition_sface_2021dec.onnx
    ├── frontend/dist/index.html
    └── ... (Qt DLLs, Python stdlib, deps)
```

**Datos mutables** viven separados en `%LOCALAPPDATA%\Safe Link Station\`:

```
Safe Link Station/
├── .env                        # STATION_API_KEY, SUPABASE_*, etc.
├── data/
│   ├── db/trabajadores.db      # SQLite local (asistencias offline)
│   └── cache/<empresa_id>/     # Embeddings + fotos descargadas
└── logs/station.log
```

Esta separación es clave: `Program Files` es read-only para usuarios sin
admin, así que ningún dato mutable (cache, BD, logs, `.env`) puede vivir
ahí. La resolución la maneja `station/src/utils/paths.py → writable_root()`.

## Personalización

- **Versión**: la define release-please según los commits convencionales
  (`feat:` → minor, `fix:` → patch). Se inyecta en `installer.nsi` con
  `-DAPP_VERSION=X.Y.Z` desde el CI.
- **Branding**: cambia `!define APP_PUBLISHER` y `!define APP_URL`.
- **Iconos**: usa `station/src/assets/icon.ico`.
- **Páginas custom**: la página `ConfigPage` pide los datos de Supabase
  durante la instalación. Si quieres más campos, edítalos en la sección
  "Pagina custom de configuracion" del `.nsi`.

## Requisitos

- **Windows** (NSIS no compila en Linux/macOS sin Wine)
- **NSIS 3.x** instalado y en PATH ([descargar](https://nsis.sourceforge.io/Download))
- **PyInstaller 6.x**
- **Python 3.10**
- **Node 20** (para compilar el frontend)
