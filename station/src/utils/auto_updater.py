"""
Auto-Updater Module para SafeLink Station.
Verifica actualizaciones en startup y descarga en background.

Fuente de updates: GitHub Releases del repo del proyecto.
Estructura esperada por release:
  - SafeLinkStation_Setup_X.Y.Z.exe  (instalador NSIS)
  - version.txt                       (numero de version)
  - SHA256SUMS.txt                    (hash para verificar integridad)

Para desactivar auto-update: AUTO_UPDATE_ENABLED=false en .env
"""

import hashlib
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

# Repo de GitHub donde estan los releases (sobrescribible via env)
GITHUB_REPO = os.environ.get(
    "SAFELINK_UPDATE_REPO",
    "Safe-LM/app-login-trabajadores-desktop",
)
RELEASE_LATEST = f"https://github.com/{GITHUB_REPO}/releases/latest/download"

# Archivos del release
LOCAL_VERSION_FILE = "version.txt"
CHECK_INTERVAL_HOURS = 24

# Version actual del app — se sobrescribe en runtime con version.txt
# si existe en el directorio de instalacion.
CURRENT_VERSION = "5.1.0"


def is_enabled() -> bool:
    """Permite al usuario desactivar updates con AUTO_UPDATE_ENABLED=false en .env"""
    val = os.environ.get("AUTO_UPDATE_ENABLED", "true").strip().lower()
    return val not in ("false", "0", "no", "off")


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
    Verifica si hay una nueva version en GitHub Releases.

    Returns:
        (hay_update, nueva_version, download_url)
    """
    if not is_enabled():
        return False, None, None

    try:
        version_url = f"{RELEASE_LATEST}/version.txt"
        req = Request(version_url, headers={"User-Agent": "SafeLink Station"})
        with urlopen(req, timeout=10) as response:  # nosec B310 - URL hardcoded https GitHub
            remote_version = response.read().decode("utf-8").strip()

        local_version = get_local_version()

        if _compare_versions(remote_version, local_version) > 0:
            installer_name = f"SafeLinkStation_Setup_{remote_version}.exe"
            download_url = f"{RELEASE_LATEST}/{installer_name}"
            return True, remote_version, download_url

        return False, None, None

    except (URLError, HTTPError, TimeoutError) as e:
        logger.warning(f"Error verificando actualizaciones: {e}")
        return False, None, None
    except Exception as e:
        logger.error(f"Error inesperado verificando updates: {e}")
        return False, None, None


def fetch_expected_sha256(installer_filename: str) -> Optional[str]:
    """Descarga SHA256SUMS.txt y devuelve el hash esperado para el installer."""
    try:
        req = Request(f"{RELEASE_LATEST}/SHA256SUMS.txt", headers={"User-Agent": "SafeLink Station"})
        with urlopen(req, timeout=10) as response:  # nosec B310 - URL hardcoded https GitHub
            content = response.read().decode("utf-8")
        for line in content.splitlines():
            parts = line.strip().split(None, 1)
            if len(parts) == 2 and parts[1] == installer_filename:
                return parts[0].lower()
        return None
    except Exception as e:
        logger.warning(f"No se pudo obtener SHA256SUMS.txt: {e}")
        return None


def verify_file_sha256(path: str, expected: str) -> bool:
    """Compara el SHA256 de un archivo con el esperado."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    actual = h.hexdigest().lower()
    return actual == expected.lower()


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


def download_update(download_url: str, progress_callback=None, verify: bool = True) -> Optional[str]:
    """
    Descarga el instalador y opcionalmente verifica su SHA256.

    Args:
        download_url: URL del archivo a descargar
        progress_callback: callback(bytes_descargados, total_bytes)
        verify: si True, descarga SHA256SUMS.txt y valida el archivo

    Returns:
        Ruta del archivo descargado, o None si fallo o el hash no coincide.
    """
    import tempfile
    temp_dir = Path(tempfile.gettempdir()) / "safelnk_updates"
    temp_dir.mkdir(parents=True, exist_ok=True)

    filename = download_url.split("/")[-1]
    dest_path = temp_dir / filename

    try:
        req = Request(download_url, headers={"User-Agent": "SafeLink Station"})
        with urlopen(req, timeout=60) as response:  # nosec B310 - URL hardcoded https GitHub
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

        if verify:
            expected = fetch_expected_sha256(filename)
            if expected is None:
                logger.warning("SHA256SUMS.txt no disponible — saltando verificacion")
            elif not verify_file_sha256(str(dest_path), expected):
                logger.error("Hash SHA256 NO coincide. Borrando descarga.")
                dest_path.unlink(missing_ok=True)
                return None
            else:
                logger.info("Hash SHA256 verificado correctamente")

        return str(dest_path)

    except Exception as e:
        logger.error(f"Error descargando update: {e}")
        if dest_path.exists():
            dest_path.unlink()
        return None


def install_update(installer_path: str, silent: bool = False) -> bool:
    """
    Ejecuta el instalador NSIS de actualizacion.

    Args:
        installer_path: Ruta al archivo .exe del instalador
        silent: si True, instalar en modo silencioso (/S de NSIS).
                False muestra el wizard normal — recomendado para que
                el usuario confirme y vea el progreso.

    Returns:
        True si el proceso se inicio. La app debe cerrarse despues.
    """
    try:
        logger.info(f"Iniciando instalador de actualizacion: {installer_path}")

        if sys.platform == "win32":
            args = [installer_path]
            if silent:
                args.append("/S")  # Modo silencioso de NSIS
            # creationflags 0x00000008 = DETACHED_PROCESS (no bloquea al padre)
            DETACHED_PROCESS = 0x00000008
            subprocess.Popen(
                args,
                creationflags=DETACHED_PROCESS,
                close_fds=True,
            )
            return True
        else:
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