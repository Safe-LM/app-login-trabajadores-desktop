"""
Aplicación de escritorio para reconocimiento facial de trabajadores.
Usa PyQt5 para la interfaz gráfica y OpenCV para la cámara.
"""

import sys
import os
from pathlib import Path

# Configurar rutas para la nueva estructura profesional
BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = BASE_DIR / "src"
# Añadir 'src' al path para que las importaciones directas de 'windows' y 'utils' funcionen
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

import logging
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt, QTimer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    """Función principal de la aplicación."""
    # Crear aplicación Qt
    app = QApplication(sys.argv)
    app.setApplicationName("Safe Link Monitoring - Control de Asistencia")
    app.setOrganizationName("Safe Link Monitoring")
    app.setApplicationVersion("2.0.4")

    # Configurar estilo de la aplicación
    app.setStyle("Fusion")

    # Estilo global premium para toda la aplicación
    app.setStyleSheet("""
        QToolTip {
            background-color: #1e293b;
            color: #e2e8f0;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 8px;
            font-size: 12px;
        }
        QMenu {
            background-color: #1e293b;
            color: #e2e8f0;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 5px;
        }
        QMenu::item:selected {
            background-color: #6366f1;
            border-radius: 5px;
        }
    """)

    # Mostrar splash screen
    from windows.splash_window import SplashScreen

    splash = SplashScreen()
    splash.show()
    app.processEvents()

    # Cargar módulos de forma perezosa
    splash.update_message("Cargando interfaz de usuario...")
    app.processEvents()

    # Importar ventana de login (ligera)
    from windows.login_window import LoginWindow

    splash.update_message("Preparando sistema de autenticación...")
    app.processEvents()

    # Crear ventana de login (sin inicializar reconocimiento facial aún)
    login_window = LoginWindow()

    splash.update_message("Inicializando aplicación...")
    app.processEvents()

    # Cerrar splash y mostrar login con fade
    def _show_login():
        if hasattr(splash, "finish_loading"):
            splash.finish_loading()
        splash.finish(login_window)
        login_window.show()

    QTimer.singleShot(600, _show_login)

    # Ejecutar aplicación
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
