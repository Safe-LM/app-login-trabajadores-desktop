"""
Gestiona identidad y heartbeat de la estacion fisica.
Lee STATION_API_KEY del .env, se registra en Supabase al arrancar
y manda heartbeat cada 60s en un QThread de background.
"""

import os
import socket
import logging
import platform
import subprocess
import hashlib
from typing import Optional
from dotenv import load_dotenv
from PyQt5.QtCore import QThread, pyqtSignal, QTimer, QObject

# El .env ya se carga en main._bootstrap_env() (priorizando la ruta
# escribible). Solo cargamos aqui como fallback para cuando este modulo
# se importa fuera del flujo normal (tests, scripts standalone).
try:
    from utils.paths import env_path as _env_path
    _env = _env_path()
    if _env.exists():
        load_dotenv(_env, override=False)
except Exception:
    pass
logger = logging.getLogger(__name__)

# Version reportada al panel en cada heartbeat. Se toma de build_info.py
# que es inyectado por CI durante el empaquetado del .exe. En dev local
# (sin build_info) cae al placeholder.
try:
    from build_info import VERSION as APP_VERSION  # type: ignore
except Exception:
    APP_VERSION = "dev"
HEARTBEAT_INTERVAL_MS = 60_000  # 60 segundos

# Estado de salud — se actualiza desde dashboard_window / sync_manager
_health_empleados_count: int = 0
_health_camara_ok: Optional[bool] = None
_health_encodings_ver: int = 0


def report_health(empleados_count: int = 0, camara_ok: Optional[bool] = None, encodings_ver: int = 0):
    """Llamado desde el dashboard o sync_manager para actualizar métricas de salud."""
    global _health_empleados_count, _health_camara_ok, _health_encodings_ver
    _health_empleados_count = empleados_count
    if camara_ok is not None:
        _health_camara_ok = camara_ok
    _health_encodings_ver = encodings_ver


def get_station_api_key() -> Optional[str]:
    """Lee STATION_API_KEY en tiempo real (soporta escritura post-setup)."""
    return os.environ.get("STATION_API_KEY") or os.getenv("STATION_API_KEY")


# Compatibilidad: valor leido al importar (puede ser None si setup no corrió aún)
STATION_API_KEY: Optional[str] = get_station_api_key()


class StationInfo:
    """Info de la estacion obtenida en el primer heartbeat exitoso."""
    dispositivo_id: Optional[str] = None
    empresa_id: Optional[str] = None
    sucursal_id: Optional[str] = None
    nombre: Optional[str] = None
    config: dict = {}

    @classmethod
    def from_response(cls, data: dict):
        cls.dispositivo_id = data.get("dispositivo_id")
        cls.empresa_id     = data.get("empresa_id")
        cls.sucursal_id    = data.get("sucursal_id")
        cls.nombre         = data.get("nombre")
        cls.config         = data.get("config") or {}
        return cls


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def get_hostname() -> str:
    try:
        return socket.gethostname()
    except Exception:
        return platform.node() or "unknown"


def get_hwid() -> str:
    """Genera un ID único para el hardware (Machine GUID o UUID)."""
    try:
        # En Windows: reg query HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography /v MachineGuid
        if platform.system() == "Windows":
            out = subprocess.check_output(
                ["reg", "query",
                 r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography",
                 "/v", "MachineGuid"],
                shell=False,
            ).decode()
            guid = out.split()[-1]
            return hashlib.sha256(guid.encode()).hexdigest()[:16].upper()
        else:
            # Fallback para otros sistemas
            import uuid
            return hashlib.sha256(str(uuid.getnode()).encode()).hexdigest()[:16].upper()
    except Exception:
        return "HW-UNKNOWN"


class HeartbeatWorker(QObject):
    """Corre en QThread — manda heartbeat a Supabase cada 60s."""
    heartbeat_ok       = pyqtSignal(dict)
    heartbeat_fail     = pyqtSignal(str)
    heartbeat_revocada = pyqtSignal()    # estación revocada desde el panel

    def __init__(self):
        super().__init__()
        self._timer = None

    def start(self):
        # Crear el QTimer aquí — ya estamos dentro del QThread correcto
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._beat)
        self._beat()  # primer beat inmediato
        self._timer.start(HEARTBEAT_INTERVAL_MS)

    def stop(self):
        if self._timer:
            self._timer.stop()

    def _beat(self):
        if not get_station_api_key():
            self.heartbeat_fail.emit("STATION_API_KEY no configurada en .env")
            return
        try:
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                self.heartbeat_fail.emit("Sin conexion a Supabase")
                return

            result = sb.rpc("station_heartbeat", {
                "p_api_key":         get_station_api_key(),
                "p_ip_local":        get_local_ip(),
                "p_hostname":        get_hostname(),
                "p_version":         APP_VERSION,
                "p_hwid":            get_hwid(),
                "p_empleados_count": _health_empleados_count,
                "p_camara_ok":       _health_camara_ok,
                "p_encodings_ver":   _health_encodings_ver if _health_encodings_ver > 0 else None,
            }).execute()

            data = result.data
            if data and data.get("ok"):
                StationInfo.from_response(data)
                logger.info(f"Heartbeat OK — {StationInfo.nombre} ({StationInfo.dispositivo_id})")
                self.heartbeat_ok.emit(data)
            else:
                err = data.get("error", "respuesta invalida") if data else "sin datos"
                revocada = data.get("revocada", False) if data else False
                logger.warning(f"Heartbeat rechazado: {err} (revocada={revocada})")
                if revocada:
                    self.heartbeat_revocada.emit()
                else:
                    self.heartbeat_fail.emit(err)

        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            self.heartbeat_fail.emit(str(e))


class StationManager(QObject):
    """
    Punto de entrada para la identidad de estacion.
    Uso:
        manager = StationManager()
        ok, msg = manager.validate()   # en splash
        manager.start_heartbeat()       # tras login exitoso
        manager.stop()                  # al cerrar app
    """
    status_changed = pyqtSignal(str, str)  # estado, mensaje

    def __init__(self):
        super().__init__()
        self._thread = QThread()
        self._worker = HeartbeatWorker()
        self._worker.moveToThread(self._thread)
        self._worker.heartbeat_ok.connect(self._on_ok)
        self._worker.heartbeat_fail.connect(self._on_fail)
        self._worker.heartbeat_revocada.connect(self._on_revocada)
        self._thread.started.connect(self._worker.start)

    def validate(self) -> tuple[bool, str]:
        """Verificacion sincrona al arrancar (antes de mostrar UI)."""
        if not get_station_api_key():
            return False, (
                "Esta estacion no tiene STATION_API_KEY configurada.\n\n"
                "Ve al panel web → Estaciones → crear nueva estacion,\n"
                "copia la API Key y agrégala al archivo .env:\n\n"
                "STATION_API_KEY=sk_..."
            )
        return True, "API Key encontrada"

    def start_heartbeat(self):
        if not self._thread.isRunning():
            self._thread.start()

    def stop(self):
        self._worker.stop()
        self._thread.quit()
        self._thread.wait(3000)

    def _on_ok(self, _data: dict):
        self.status_changed.emit("online", StationInfo.nombre or "Estacion")

    def _on_fail(self, err: str):
        self.status_changed.emit("offline", err)

    def _on_revocada(self):
        self.status_changed.emit("revocada", "Estación revocada desde el panel web")


# Instancia global — se inicializa en main.py después de QApplication
# Usar: from utils.station_manager import get_station
_station_instance: "StationManager | None" = None


def get_station() -> "StationManager":
    global _station_instance
    if _station_instance is None:
        _station_instance = StationManager()
    return _station_instance


# Alias de compatibilidad — solo válido después de que main.py llame get_station()
class _LazyStation:
    def __getattr__(self, name):
        return getattr(get_station(), name)

station = _LazyStation()
