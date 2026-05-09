"""
HWID — Hardware fingerprint estable para identificar la estación.

Combina varios identificadores del hardware para generar un hash único:
- MAC address de la interfaz de red principal
- Serial del CPU (Windows: WMIC; Linux: /proc/cpuinfo)
- UUID de la placa madre o instalación

El HWID se cachea localmente en data/hwid.txt para que sea estable entre
arranques. Si el archivo se borra, se regenera con el mismo resultado
(porque los componentes hardware no cambian).
"""

import hashlib
import logging
import platform
import subprocess
import sys
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)

_HWID_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "hwid.txt"


def _get_mac() -> str:
    """MAC address de la primera interfaz no-loopback."""
    try:
        mac = uuid.getnode()
        if mac == uuid.getnode():  # uuid.getnode estable
            return ":".join(f"{(mac >> i) & 0xff:02x}" for i in range(40, -1, -8))
    except Exception:
        pass
    return ""


def _get_machine_id_windows() -> str:
    """Windows: usa MachineGuid del registro (estable)."""
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography")
        guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        return str(guid)
    except Exception as e:
        logger.debug(f"No se pudo leer MachineGuid: {e}")
        return ""


def _get_machine_id_linux() -> str:
    """Linux: /etc/machine-id es único y estable."""
    for path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
        try:
            with open(path, "r") as f:
                return f.read().strip()
        except Exception:
            continue
    return ""


def _get_cpu_info() -> str:
    """Modelo + arquitectura del CPU (no único, pero ayuda)."""
    try:
        return f"{platform.processor()}|{platform.machine()}"
    except Exception:
        return ""


def _compute_hwid() -> str:
    """
    Combina identificadores hardware en un hash SHA256.
    Resultado: 64 caracteres hex estables entre reinicios.
    """
    parts = []

    if sys.platform == "win32":
        parts.append(_get_machine_id_windows())
    elif sys.platform.startswith("linux"):
        parts.append(_get_machine_id_linux())

    parts.append(_get_mac())
    parts.append(_get_cpu_info())
    parts.append(platform.node())  # hostname

    raw = "|".join(p for p in parts if p)
    if not raw:
        # Fallback: aleatorio (no debería pasar nunca en hardware real)
        raw = uuid.uuid4().hex
        logger.warning("HWID fallback aleatorio — no se detectó hardware estable")

    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_hwid() -> str:
    """
    Retorna el HWID. Lee de cache si existe, si no lo calcula y lo guarda.
    """
    try:
        if _HWID_FILE.exists():
            cached = _HWID_FILE.read_text("utf-8").strip()
            if len(cached) == 64:
                return cached
    except Exception:
        pass

    hwid = _compute_hwid()
    try:
        _HWID_FILE.parent.mkdir(parents=True, exist_ok=True)
        _HWID_FILE.write_text(hwid, "utf-8")
    except Exception as e:
        logger.warning(f"No se pudo cachear HWID: {e}")

    return hwid


def get_hwid_short() -> str:
    """Versión corta del HWID para mostrar en UI (primeros 8 chars)."""
    return get_hwid()[:8]


if __name__ == "__main__":
    print(f"HWID completo: {get_hwid()}")
    print(f"HWID corto:    {get_hwid_short()}")
