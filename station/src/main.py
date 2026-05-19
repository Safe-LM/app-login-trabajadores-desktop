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

from dotenv import dotenv_values, load_dotenv

def _bootstrap_env() -> None:
    """
    Resuelve la configuracion de entorno en tres capas, de menor a mayor
    prioridad:

      1. server.env embebido en el bundle  -> defaults del fabricante
         (SUPABASE_URL, SUPABASE_KEY). Garantiza que la estacion arranca
         "out of the box" en cualquier maquina, sin que el operario tenga
         que tocar variables de entorno.

      2. .env junto al .exe (bundled_env_path)  -> compatibilidad con
         instalaciones NSIS antiguas. Si existe, se migra a la ruta
         escribible para que la app pueda mutarlo despues.

      3. .env de usuario en %LOCALAPPDATA% (env_path)  -> identidad de
         esta estacion concreta (STATION_API_KEY) y overrides locales.

    Politica: las capas 2 y 3 sobreescriben a la 1. Si una clave queda
    vacia tras cargar capas 2/3, se reinstala desde la capa 1 para evitar
    el bug clasico "SUPABASE_KEY= vacio bloquea el arranque".
    """
    from utils.paths import env_path, bundled_env_path, bundled_server_env_path

    server_env = bundled_server_env_path()
    writable   = env_path()
    bundled    = bundled_env_path()

    # Capa 1: defaults embebidos. override=False — no pisamos lo que ya
    # pudiera existir en el entorno del proceso (CI, tests, env vars del
    # SO). Si el .env de usuario los reescribe luego, gana el usuario.
    if server_env.exists():
        load_dotenv(server_env, override=False)

    # Migracion legacy: si writable no existe pero bundled si, copiar.
    if not writable.exists() and bundled.exists() and bundled != writable:
        try:
            writable.write_text(bundled.read_text("utf-8"), "utf-8")
        except Exception:
            pass

    # Capa 2/3: .env del usuario. override=True — la configuracion local
    # de la estacion manda sobre los defaults.
    if writable.exists():
        load_dotenv(writable, override=True)
    elif bundled.exists():
        load_dotenv(bundled, override=True)
    else:
        for _p in Path(__file__).resolve().parents:
            _env = _p / ".env"
            if _env.exists():
                load_dotenv(_env, override=True)
                break

    # Reparacion: si las capas 2/3 dejaron SUPABASE_URL/KEY vacios
    # (caso del wizard NSIS antiguo que escribia campos en blanco),
    # restauramos los defaults embebidos. Sin esto, una sola linea
    # "SUPABASE_KEY=" en el .env del usuario rompe la app.
    if server_env.exists():
        defaults = dotenv_values(server_env)
        for k, v in defaults.items():
            if v and not os.environ.get(k):
                os.environ[k] = v

_bootstrap_env()

from PyQt5.QtCore import Qt, QCoreApplication, QTimer  # noqa: E402

QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts)

from PyQt5.QtGui import QIcon  # noqa: E402
from PyQt5.QtWidgets import QApplication, QMessageBox  # noqa: E402
from PyQt5 import QtWebEngineWidgets  # noqa: E402,F401  (preload requerido)

def _setup_logging() -> None:
    """
    Configura logging a stdout + archivo rotatorio en writable_root()/logs.
    Sin esto, el .exe (sin --console) no deja rastro de crashes y es
    imposible debuguear en produccion.
    """
    from logging.handlers import RotatingFileHandler
    from utils.paths import logs_root

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Limpiar handlers previos (importante si _setup_logging se llama 2 veces)
    for h in list(root.handlers):
        root.removeHandler(h)

    # Stdout (visible en dev local, ignorado en .exe sin consola)
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    root.addHandler(sh)

    # Archivo rotatorio: 5 MB x 3 = max ~15 MB por instalacion
    try:
        fh = RotatingFileHandler(
            logs_root() / "station.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except Exception:
        # Si falla el FileHandler (permisos raros) seguimos solo con stdout
        pass


_setup_logging()
logger = logging.getLogger(__name__)

# Log build info al arrancar — ayuda a debugging remoto
try:
    from build_info import get_full_version, get_dict as _get_build_dict
    logger.info("Safe Link Station — %s", get_full_version())
    _BUILD_INFO = _get_build_dict()
except ImportError:
    logger.info("Safe Link Station — modo desarrollo (sin build_info)")
    _BUILD_INFO = {"version": "dev", "commit_sha": "local", "build_date": "today"}


# ─────────────────────────────────────────────────────────────────────────────
#  Config persistente
# ─────────────────────────────────────────────────────────────────────────────
from utils.paths import config_path as _config_path
_CONFIG_PATH = _config_path()


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
        from utils.sync_manager import get_sync_manager

        sync = get_sync_manager()
        sync.sync_done.connect(lambda count: logger.info("Sync OK: %s empleados", count))
        sync.sync_error.connect(lambda msg: logger.warning("Sync error: %s", msg))
        sync.start()
        app._sync_manager = sync
        logger.info("SyncManager iniciado")
    except Exception as e:
        logger.error("No se pudo iniciar SyncManager: %s", e)

    # RealtimeListener: el dashboard_window ya levanta su propio listener
    # (RealtimeCommandListener) para escuchar comandos del panel. No
    # duplicamos suscripción aquí.

    # Auto-update check (en background, no bloquea startup)
    QTimer.singleShot(15_000, lambda: _check_for_update_async(app))


def _check_for_update_async(app: QApplication):
    """Verifica si hay nueva version en GitHub Releases y notifica al panel."""
    try:
        from utils.auto_updater import (
            get_auto_updater, is_enabled, get_local_version,
        )
        if not is_enabled():
            return

        updater = get_auto_updater()
        if updater.check_and_notify():
            logger.info(
                "Update disponible: v%s (local: v%s)",
                updater.new_version, get_local_version(),
            )
            # Notificar al panel para que el admin lo vea
            try:
                from utils.sync_manager import _notify_panel
                from utils.station_manager import StationInfo
                _notify_panel(
                    tipo="station_update_available",
                    severidad="info",
                    titulo=f"Actualización disponible · {StationInfo.nombre or 'Estación'}",
                    mensaje=f"Nueva versión v{updater.new_version}. La estación se actualizará en el próximo reinicio.",
                    metadata={
                        "current_version": get_local_version(),
                        "new_version": updater.new_version,
                    },
                    dedupe_key=f"update:{updater.new_version}:{StationInfo.dispositivo_id or 'unknown'}",
                )
            except Exception:
                pass
            # Guardar el handle para que dashboard pueda decidir descargar
            app._updater = updater
    except Exception as e:
        logger.warning("Auto-update check fallo: %s", e)


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
