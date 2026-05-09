"""
Auto-Updater Module para SafeLink Station.
Verifica actualizaciones en startup and descarga en background.
"""

import os
import json
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

# Configuración
UPDATE_SERVER_URL = "https://updates.safelnk.com"
LOCAL_VERSION_FILE = "version.txt"
CHECK_INTERVAL_HOURS = 24

# Versión actual del app
CURRENT_VERSION = "1.0.0"


def get_install_id() -> str:
    """Obtiene o genera el ID único de instalación."""
    reg_path = Path(os.path.expanduser("~")) / ".safelnk_install_id"
    if reg_path.exists():
        return reg_path.read_text().strip()
    import uuid
    install_id = str(uuid.uuid4())
    reg_path.write_text(install_id)
    return install_id


def get_local_version() -> str:
    """Obtiene la versión local del app desde version.txt."""
    version_file = Path(LOCAL_VERSION_FILE)
    if version_file.exists():
        return version_file.read_text().strip()
    return CURRENT_VERSION


def check_for_updates() -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifica si hay una nueva versión disponible.

    Returns:
        (hay_update, nueva_version, download_url)
    """
    try:
        version_url = f"{UPDATE_SERVER_URL}/version.txt"
        req = Request(version_url, headers={"User-Agent": "SafeLink Station"})
        with urlopen(req, timeout=10) as response:  # nosec B310 - URL hardcoded https
            remote_version = response.read().decode("utf-8").strip()

        local_version = get_local_version()

        if _compare_versions(remote_version, local_version) > 0:
            download_url = f"{UPDATE_SERVER_URL}/SafeLink_v{remote_version}_Setup.exe"
            return True, remote_version, download_url

        return False, None, None

    except (URLError, HTTPError, TimeoutError) as e:
        logger.warning(f"Error verificando actualizaciones: {e}")
        return False, None, None
    except Exception as e:
        logger.error(f"Error inesperado verificando updates: {e}")
        return False, None, None


def _compare_versions(remote: str, local: str) -> int:
    """
    Compara dos versiones semver.

    Returns:
        > 0 si remote > local (hay update)
        0 si son iguales
        < 0 si remote < local
    """
    def parse(v):
        return [int(x) for x in v.split(".")]

    remote_parts = parse(remote)
    local_parts = parse(local)

    for r, l in zip(remote_parts, local_parts):
        if r > l:
            return 1
        elif r < l:
            return -1

    return 0


def download_update(download_url: str, progress_callback=None) -> Optional[str]:
    """
    Descarga el instalador de actualización.

    Args:
        download_url: URL del archivo a descargar
        progress_callback: Función opcional (bytes_descargados, total_bytes)

    Returns:
        Ruta del archivo descargado o None si falla
    """
    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / "safelnk_updates"
    temp_dir.mkdir(parents=True, exist_ok=True)

    filename = download_url.split("/")[-1]
    dest_path = temp_dir / filename

    try:
        req = Request(download_url, headers={"User-Agent": "SafeLink Station"})
        with urlopen(req, timeout=60) as response:  # nosec B310 - URL hardcoded https
            total_size = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 8192

            with open(dest_path, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback and total_size > 0:
                        progress_callback(downloaded, total_size)

        logger.info(f"Update descargado: {dest_path}")
        return str(dest_path)

    except Exception as e:
        logger.error(f"Error descargando update: {e}")
        if dest_path.exists():
            dest_path.unlink()
        return None


def install_update(installer_path: str) -> bool:
    """
    Ejecuta el instalador de actualización.

    Args:
        installer_path: Ruta al archivo .exe del instalador

    Returns:
        True si se ejecutó exitosamente (la app se cerrará)
    """
    try:
        logger.info(f"Iniciando instalador de actualización: {installer_path}")

        if sys.platform == "win32":
            # En Windows, ejecutar el installer y cerrar la app
            subprocess.Popen(
                [installer_path, "/VERYSILENT", "/CLOSEAPPLICATIONS"],
                creationflags=subprocess.DETACHED_PROCESS
            )
            return True
        else:
            # En otros OS, solo abrir
            subprocess.Popen(["open", installer_path])
            return True

    except Exception as e:
        logger.error(f"Error instalando update: {e}")
        return False


class AutoUpdater:
    """Clase para manejar actualizaciones automáticas."""

    def __init__(self):
        self.update_available = False
        self.new_version: Optional[str] = None
        self.download_url: Optional[str] = None
        self.downloaded_path: Optional[str] = None
        self.check_count = 0

    def check_and_notify(self) -> bool:
        """
        Verifica updates y retorna si hay uno disponible.
        No descarga automáticamente.
        """
        self.update_available, self.new_version, self.download_url = check_for_updates()

        if self.update_available:
            logger.info(f"Nueva versión disponible: {self.new_version}")

        return self.update_available

    def check_and_download(self, progress_callback=None) -> bool:
        """
        Verifica y descarga updates automáticamente.
        """
        if not self.update_available:
            self.check_and_notify()

        if not self.update_available or not self.download_url:
            return False

        if self.downloaded_path:
            return True  # Ya descargado

        self.downloaded_path = download_update(self.download_url, progress_callback)
        return self.downloaded_path is not None

    def install_and_restart(self) -> bool:
        """
        Instala el update descargado y reinicia.
        """
        if not self.downloaded_path:
            logger.error("No hay update descargado para instalar")
            return False

        return install_update(self.downloaded_path)

    def get_version_info(self) -> dict:
        """Retorna información de versión para el heartbeat."""
        return {
            "version": get_local_version(),
            "install_id": get_install_id(),
            "update_available": self.update_available,
            "new_version": self.new_version,
        }


# Singleton global
_auto_updater: Optional[AutoUpdater] = None


def get_auto_updater() -> AutoUpdater:
    """Obtiene la instancia singleton del auto-updater."""
    global _auto_updater
    if _auto_updater is None:
        _auto_updater = AutoUpdater()
    return _auto_updater


def check_updates_on_startup() -> Optional[str]:
    """
    Verifica updates al arrancar la app.
    Retorna la nueva versión si hay disponible, None si no.
    """
    updater = get_auto_updater()
    has_update = updater.check_and_notify()

    if has_update:
        logger.info(f"Update disponible: v{updater.new_version}")
        return updater.new_version

    return None


if __name__ == "__main__":
    print(f"SafeLink Auto-Updater v{CURRENT_VERSION}")
    print(f"Versión local: {get_local_version()}")
    print(f"ID Instalación: {get_install_id()}")
    print()

    print("Verificando actualizaciones...")
    has_update, new_version, download_url = check_for_updates()

    if has_update:
        print(f" Nueva versión disponible: v{new_version}")
        print(f"  URL: {download_url}")
    else:
        print("  Ya tienes la última versión.")