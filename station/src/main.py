"""
Punto de entrada — Safe Link Monitoring Station v5.0

Flujo de arranque:
   1. Cargar .env y config persistida (data/station_config.json + STATION_API_KEY).
   2. Si la estación no está activada → SetupWindow (zero-touch o credenciales).
   3. Cuando hay api_key válida → DashboardWindow (modo kiosco).
   4. En background:
        · HeartbeatWorker cada 60s (StationManager).
        · SyncManager cada 60s (sube asistencias offline pendientes).
        · RealtimeListener (Supabase Realtime para empleados/dispositivos).
   5. Si el heartbeat marca la estación como revocada → cerrar dashboard y
      relanzar setup.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from dotenv import load_dotenv
for _p in Path(__file__).resolve().parents:
    _env = _p / ".env"
    if _env.exists():
        load_dotenv(_env, override=True)
        break

from PyQt5.QtCore import QTimer  # noqa: E402
from PyQt5.QtGui import QIcon  # noqa: E402
from PyQt5.QtWidgets import QApplication, QMessageBox  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Config persistente
# ─────────────────────────────────────────────────────────────────────────────
_CONFIG_PATH = BASE_DIR / "data" / "station_config.json"


def _load_config() -> dict:
    """Carga station_config.json. Retorna {} si no existe o está corrupto."""
    try:
        if _CONFIG_PATH.exists():
            import json

            data = json.loads(_CONFIG_PATH.read_text("utf-8"))
            if data.get("api_key"):
                return data
    except Exception as e:
        logger.warning("Config corrupta (%s) — se ignorará", e)
    return {}


def _inject_config_to_env(cfg: dict):
    if cfg.get("api_key"):
        os.environ["STATION_API_KEY"] = cfg["api_key"]


# ─────────────────────────────────────────────────────────────────────────────
#  Servicios en background (sync + realtime)
# ─────────────────────────────────────────────────────────────────────────────
def _start_background_services(app: QApplication):
    """Lanza SyncManager y RealtimeListener una vez la estación está activa.

    Diferido 2s tras mostrar el dashboard para que la UI termine de pintar
    antes de empezar a tirar consultas.
    """
    try:
        from services.sync_manager import get_sync_manager

        sync = get_sync_manager()
        sync.connection_changed.connect(
            lambda online: logger.info("Conectividad cloud: %s", "online" if online else "offline")
        )
        sync.sync_progress.connect(
            lambda subidos, restantes: logger.info(
                "Sync: %s subidos, %s pendientes", subidos, restantes
            )
            if subidos
            else None
        )
        sync.start()
        app._sync_manager = sync
        logger.info("SyncManager iniciado")
    except Exception as e:
        logger.error("No se pudo iniciar SyncManager: %s", e)

    try:
        from services.realtime_listener import get_realtime_listener
        from utils.station_manager import StationInfo

        if StationInfo.empresa_id:
            listener = get_realtime_listener()
            listener.empleado_changed.connect(
                lambda evt, rec: logger.info("Realtime empleados %s: %s", evt, rec.get("id", "?"))
            )
            listener.dispositivo_changed.connect(
                lambda evt, rec: logger.info("Realtime dispositivos %s", evt)
            )
            listener.start(StationInfo.empresa_id)
            app._realtime = listener
            logger.info("RealtimeListener suscrito (empresa=%s)", StationInfo.empresa_id)
        else:
            logger.info("RealtimeListener pospuesto: sin empresa_id (esperando heartbeat)")
            # Reintentar cuando llegue el primer heartbeat OK
            try:
                from utils.station_manager import get_station

                def _retry(state, _msg):
                    if state == "online" and StationInfo.empresa_id and not getattr(app, "_realtime", None):
                        from services.realtime_listener import get_realtime_listener
                        l = get_realtime_listener()
                        l.start(StationInfo.empresa_id)
                        app._realtime = l
                        logger.info("RealtimeListener tardío suscrito")

                get_station().status_changed.connect(_retry)
            except Exception:
                pass
    except Exception as e:
        logger.error("No se pudo iniciar RealtimeListener: %s", e)


# ─────────────────────────────────────────────────────────────────────────────
#  Lanzamiento del Dashboard
# ─────────────────────────────────────────────────────────────────────────────
def _launch_dashboard(app: QApplication):
    from utils.station_manager import StationInfo, get_station

    cfg = _load_config()
    if cfg:
        StationInfo.dispositivo_id = cfg.get("dispositivo_id")
        StationInfo.empresa_id = cfg.get("empresa_id")
        StationInfo.sucursal_id = cfg.get("sucursal_id")
        StationInfo.nombre = cfg.get("nombre", "Estación")

    station = get_station()
    app._station = station

    # Reset del cliente Supabase para que tome la api_key fresca del entorno
    try:
        from utils.supabase_client import reset_supabase_client

        reset_supabase_client()
    except Exception:
        pass

    # Inicializar la base local + reparaciones de schema
    try:
        from utils.database import init_db

        init_db()
    except Exception as e:
        logger.error("init_db falló: %s", e)

    logger.info("Iniciando dashboard de la estación…")
    try:
        from windows.dashboard_window import DashboardWindow

        app._kiosk = DashboardWindow()
    except Exception as e:
        logger.exception("DashboardWindow falló")
        QMessageBox.critical(
            None, "Error al iniciar", f"No se pudo iniciar el dashboard.\n\n{e}"
        )
        sys.exit(1)
        return

    app._kiosk.showMaximized()

    def _kick_services():
        try:
            station.start_heartbeat()
            station.status_changed.connect(lambda state, msg: _on_station_status(app, state, msg))
            logger.info("Heartbeat iniciado")
        except Exception as e:
            logger.error("Heartbeat init: %s", e)
        _start_background_services(app)

    QTimer.singleShot(2000, _kick_services)


def _on_station_status(app: QApplication, state: str, _msg: str):
    """Si la estación es revocada → borrar config local y volver a setup."""
    if state != "revocada":
        return
    logger.warning("Estación revocada — relanzando setup")
    try:
        _CONFIG_PATH.unlink(missing_ok=True)
    except Exception:
        pass
    os.environ.pop("STATION_API_KEY", None)
    if hasattr(app, "_realtime") and app._realtime:
        try:
            app._realtime.stop()
        except Exception:
            pass
    if hasattr(app, "_sync_manager") and app._sync_manager:
        try:
            app._sync_manager.stop()
        except Exception:
            pass
    if hasattr(app, "_kiosk") and app._kiosk:
        app._kiosk.close()
    _launch_setup(app)


# ─────────────────────────────────────────────────────────────────────────────
#  Lanzamiento del Setup
# ─────────────────────────────────────────────────────────────────────────────
def _launch_setup(app: QApplication):
    from windows.setup_window import SetupWindow

    app._setup = SetupWindow()
    app._setup.show()

    def _on_complete():
        logger.info("Setup completo — lanzando dashboard")
        try:
            app._setup.close()
        except Exception:
            pass
        app._setup = None
        _launch_dashboard(app)

    app._setup.setup_complete.connect(_on_complete)


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────
def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Safe Link Monitoring")
    app.setOrganizationName("Safe Link Monitoring")
    app.setApplicationVersion("5.0.0")
    app.setStyle("Fusion")

    icon_path = SRC_DIR / "assets" / "icon.ico"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))

    app.setStyleSheet(
        """
        QToolTip {
            background-color: #1e293b; color: #e2e8f0;
            border: 1px solid #334155; border-radius: 8px; padding: 8px; font-size: 12px;
        }
        QMenu {
            background-color: #1e293b; color: #e2e8f0;
            border: 1px solid #334155; border-radius: 8px; padding: 5px;
        }
        QMenu::item:selected { background-color: #2563eb; border-radius: 5px; }
        """
    )

    cfg = _load_config()
    if cfg:
        _inject_config_to_env(cfg)
        logger.info(
            "Config encontrada — estación: %s (%s…)",
            cfg.get("nombre", "?"),
            (cfg.get("dispositivo_id") or "")[:8],
        )
        _launch_dashboard(app)
    elif os.environ.get("STATION_API_KEY"):
        logger.info("STATION_API_KEY presente en .env (modo legacy) — saltando setup")
        _launch_dashboard(app)
    else:
        logger.info("Sin configuración — iniciando setup")
        _launch_setup(app)

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
