r"""
Resuelve rutas escribibles para datos mutables de la station (cache de
empleados, modelos DNN descargados, etc.).

El problema: cuando la station se instala via NSIS en C:\Program Files\,
ese directorio es read-only para usuarios sin admin. Escribir cache ahi
falla con [Errno 13] Permission denied.

Politica:
  * Si la station corre desde una instalacion protegida (Program Files,
    Program Files (x86), o equivalentes en otros OS) -> usar APPDATA.
  * Si corre desde el repo (dev local, python main.py) -> seguir usando
    station/data/, station/models/ como antes.

Esta heuristica se basa en la ruta del binario / __file__, no en
permisos reales: es estable y no requiere intentar-y-fallar.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


_STATION_ROOT = Path(__file__).resolve().parent.parent.parent


def _is_protected_location(root: Path) -> bool:
    """True si root esta dentro de un directorio del sistema read-only."""
    try:
        s = str(root).lower()
    except Exception:
        return False
    markers = (
        "\\program files\\",
        "\\program files (x86)\\",
        "/usr/local/",
        "/usr/share/",
        "/opt/",
        "/applications/",
    )
    return any(m in s for m in markers)


def _user_data_root() -> Path:
    """Directorio escribible por usuario para datos persistentes."""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return Path(base) / "Safe Link Station"
        return Path.home() / "AppData" / "Local" / "Safe Link Station"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Safe Link Station"
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "safe-link-station"
    return Path.home() / ".local" / "share" / "safe-link-station"


def writable_root() -> Path:
    """
    Raiz escribible para todos los datos mutables. Igual a _STATION_ROOT
    en dev local; %LOCALAPPDATA%\\Safe Link Station en build instalado.
    """
    if _is_protected_location(_STATION_ROOT):
        root = _user_data_root()
        root.mkdir(parents=True, exist_ok=True)
        return root
    return _STATION_ROOT


def cache_root() -> Path:
    """Directorio para caches de empleados, embeddings, fotos, etc."""
    p = writable_root() / "data" / "cache"
    p.mkdir(parents=True, exist_ok=True)
    return p


def models_root() -> Path:
    """
    Directorio de modelos DNN. Si la instalacion bundled trae modelos
    en su ruta read-only y aun no se han copiado a la zona escribible,
    los modelos se buscaran ahi para lectura — pero la descarga (escritura)
    siempre va a writable_root().
    """
    p = writable_root() / "models"
    p.mkdir(parents=True, exist_ok=True)
    return p


def bundled_models_root() -> Path:
    """
    Modelos pre-empaquetados en la instalacion (read-only).

    PyInstaller --onedir pone los datos en `<install>/_internal/`, no en
    `<install>/` directamente. _STATION_ROOT resuelve a `<install>/`
    (porque paths.py vive en `_internal/utils/`), asi que el path
    "naive" `_STATION_ROOT / 'models'` queda fuera del bundle y los
    .onnx no se encuentran.

    Detectamos el bundle en orden:
      1. sys._MEIPASS — definido en --onefile y --onedir modernos
      2. parent de __file__ subiendo 2 niveles + 'models' — caso --onedir
         donde paths.py vive en `_internal/utils/`
      3. _STATION_ROOT/models — dev local (sin bundle)
    """
    # 1. PyInstaller expone _MEIPASS apuntando a la carpeta de extraccion
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidate = Path(meipass) / "models"
        if candidate.exists():
            return candidate

    # 2. --onedir clasico: utils/ esta en _internal/, modelos en _internal/models/
    here = Path(__file__).resolve()
    candidate = here.parent.parent / "models"  # _internal/utils -> _internal/models
    if candidate.exists():
        return candidate

    # 3. Dev local: station/src/utils/paths.py -> station/models/
    return _STATION_ROOT / "models"


def config_path() -> Path:
    """station_config.json (datos persistentes de provisioning)."""
    p = writable_root() / "data"
    p.mkdir(parents=True, exist_ok=True)
    return p / "station_config.json"


def logs_root() -> Path:
    """Directorio de logs persistentes."""
    p = writable_root() / "logs"
    p.mkdir(parents=True, exist_ok=True)
    return p


def env_path() -> Path:
    """
    Ruta del .env escribible. En instalacion read-only se prefiere
    %LOCALAPPDATA%\\Safe Link Station\\.env. En dev local sigue siendo
    el .env del repo.
    """
    return writable_root() / ".env"


def bundled_env_path() -> Path:
    """.env que el instalador NSIS deja junto al .exe (read-only en builds)."""
    return _STATION_ROOT / ".env"
