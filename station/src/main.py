"""
Punto de entrada de Safe Link Monitoring Station v3.0
"""

import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR  = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

# Cargar .env con path absoluto ANTES de importar cualquier módulo
# que lea variables de entorno al importarse
from dotenv import load_dotenv
for _p in Path(__file__).resolve().parents:
    _env = _p / ".env"
    if _env.exists():
        load_dotenv(_env, override=True)
        break

import logging
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt, QTimer

# Requerido por QtWebEngine — debe ir ANTES de QApplication
QApplication.setAttribute(Qt.AA_ShareOpenGLContexts)
# Pre-importar WebEngine antes de QApplication
from PyQt5.QtWebEngineWidgets import QWebEngineView  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


def _launch_main_app():
    """Muestra splash → login → heartbeat."""
    from windows.splash_window import SplashScreen
    from windows.login_window import LoginWindow
    from utils.station_manager import station

    app = QApplication.instance()

    app._splash = SplashScreen()
    app._splash.show()
    QApplication.processEvents()

    app._splash.update_message("Preparando reconocimiento facial...")
    QApplication.processEvents()

    app._login_window = LoginWindow()

    def _show():
        if hasattr(app._splash, "finish_loading"):
            app._splash.finish_loading()
        app._splash.finish(app._login_window)
        app._login_window.show()
        station.start_heartbeat()

    QTimer.singleShot(600, _show)


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Safe Link Monitoring")
    app.setOrganizationName("Safe Link Monitoring")
    app.setApplicationVersion("3.0.0")
    app.setStyle("Fusion")
    app.setStyleSheet("""
        QToolTip {
            background-color: #1e293b; color: #e2e8f0;
            border: 1px solid #334155; border-radius: 8px; padding: 8px; font-size: 12px;
        }
        QMenu {
            background-color: #1e293b; color: #e2e8f0;
            border: 1px solid #334155; border-radius: 8px; padding: 5px;
        }
        QMenu::item:selected { background-color: #2563eb; border-radius: 5px; }
    """)

    from utils.station_manager import get_station
    station = get_station()  # crear DESPUÉS de QApplication y .env cargado
    app._station = station
    app._setup_window = None

    ok, _ = station.validate()

    if not ok:
        from windows.setup_window import SetupWindow
        app._setup_window = SetupWindow()
        app._setup_window.show()

        def _after_setup():
            _launch_main_app()
            # Destruir setup_window después de que el event loop procese los
            # eventos de paint pendientes, evitando "wrapped C/C++ deleted"
            QTimer.singleShot(500, lambda: setattr(app, "_setup_window", None))

        app._setup_window.setup_complete.connect(_after_setup)
    else:
        _launch_main_app()

    app.aboutToQuit.connect(station.stop)
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
