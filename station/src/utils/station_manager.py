"""
Gestiona identidad y heartbeat de la estacion fisica.
Lee STATION_API_KEY del .env, se registra en Supabase al arrancar
y manda heartbeat cada 60s en un QThread de background.
"""

import os
import socket
import logging
import platform
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from PyQt5.QtCore import QThread, pyqtSignal, QTimer, QObject

_here = Path(__file__).resolve()
for _p in _here.parents:
    if (_p / ".env").exists():
        load_dotenv(_p / ".env", override=False)
        break
logger = logging.getLogger(__name__)

APP_VERSION = "3.0.0"
HEARTBEAT_INTERVAL_MS = 60_000  # 60 segundos


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


class HeartbeatWorker(QObject):
    """Corre en QThread — manda heartbeat a Supabase cada 60s."""
    heartbeat_ok    = pyqtSignal(dict)   # emite info del dispositivo
    heartbeat_fail  = pyqtSignal(str)    # emite mensaje de error

    def __init__(self):
        super().__init__()
        self._timer = QTimer()
        self._timer.timeout.connect(self._beat)

    def start(self):
        self._beat()  # primer beat inmediato
        self._timer.start(HEARTBEAT_INTERVAL_MS)

    def stop(self):
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
                "p_api_key":  get_station_api_key(),
                "p_ip_local": get_local_ip(),
                "p_hostname": get_hostname(),
                "p_version":  APP_VERSION,
            }).execute()

            data = result.data
            if data and data.get("ok"):
                StationInfo.from_response(data)
                logger.info(f"Heartbeat OK — {StationInfo.nombre} ({StationInfo.dispositivo_id})")
                self.heartbeat_ok.emit(data)
            else:
                err = data.get("error", "respuesta invalida") if data else "sin datos"
                logger.warning(f"Heartbeat rechazado: {err}")
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

    def _on_ok(self, data: dict):
        self.status_changed.emit("online", StationInfo.nombre or "Estacion")

    def _on_fail(self, err: str):
        self.status_changed.emit("offline", err)


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
