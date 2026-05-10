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
    """Modelos pre-empaquetados en la instalacion (read-only)."""
    return _STATION_ROOT / "models"
