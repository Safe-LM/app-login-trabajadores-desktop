"""
ProvisioningWindow — Pantalla de activación zero-touch.

Aparece cuando la estación no tiene configuración guardada.
Muestra el HWID de la máquina y hace polling silencioso cada 5s
a Supabase. Cuando el admin activa la estación desde el panel web,
la ventana detecta la api_key automáticamente y arranca el sistema.

El técnico físico solo hace una cosa: copiar el HWID y mandárselo
al admin. No toca ningún archivo, no escribe credenciales.
"""

import json
import logging
import os

from PyQt5.QtCore import QObject, QThread, QTimer, Qt, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import (
    QApplication, QHBoxLayout, QLabel, QLineEdit,
    QMainWindow, QPushButton, QVBoxLayout, QWidget,
)

logger = logging.getLogger(__name__)

from utils.paths import config_path as _config_path
_CONFIG_PATH = _config_path()


# ─────────────────────────────────────────────────────────────────────────────
#  Worker — polling silencioso cada 5s
# ─────────────────────────────────────────────────────────────────────────────
class _ProvisioningPoller(QObject):
    activated = pyqtSignal(dict)   # emite el payload completo cuando se activa
    error     = pyqtSignal(str)

    def __init__(self, hwid: str):
        super().__init__()
        self._hwid    = hwid
        self._running = False
        self._timer   = None

    def start(self):
        self._running = True
        self._timer   = QTimer(self)
        self._timer.setInterval(5_000)
        self._timer.timeout.connect(self._poll)
        self._timer.start()
        self._poll()  # inmediato

    def stop(self):
        self._running = False
        if self._timer:
            self._timer.stop()

    def _poll(self):
        if not self._running:
            return
        try:
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                return
            res  = sb.rpc("get_api_key_by_hwid", {"p_hwid": self._hwid}).execute()
            data = res.data
            if data and data.get("ok"):
                self.stop()
                self.activated.emit(data)
        except Exception as e:
            logger.debug(f"Provisioning poll: {e}")


# ─────────────────────────────────────────────────────────────────────────────
#  ProvisioningWindow
# ─────────────────────────────────────────────────────────────────────────────
class ProvisioningWindow(QMainWindow):
    """
    Pantalla de activación zero-touch.
    Emite `provisioning_complete` cuando la estación queda activada.
    """
    provisioning_complete = pyqtSignal()

    def __init__(self):
        super().__init__()
        from utils.station_manager import get_hwid
        self._hwid         = get_hwid()
        self._poll_thread  = None
        self._poller       = None
        self._manual_mode  = False
        self._dots         = 0
        self._dot_timer    = None
        self._countdown    = 3
        self._cd_timer     = None
        self._init_ui()
        self._start_polling()

    # ── UI ───────────────────────────────────────────────────────────────────

    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring — Activación de estación")
        self.setMinimumSize(520, 420)
        self.resize(560, 480)
        self.setStyleSheet("QMainWindow { background: #070810; }")
        self._center()

        root = QWidget()
        root.setStyleSheet("background: #070810;")
        self.setCentralWidget(root)

        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # Barra superior decorativa
        stripe = QWidget()
        stripe.setFixedHeight(3)
        stripe.setStyleSheet(
            "background: qlineargradient(x1:0,y1:0,x2:1,y2:0,"
            "stop:0 transparent, stop:0.3 #2563eb, stop:0.7 #60a5fa, stop:1 transparent);"
        )
        outer.addWidget(stripe)

        # Contenido centrado
        center_wrap = QWidget()
        outer.addWidget(center_wrap, 1)
        cl = QVBoxLayout(center_wrap)
        cl.setContentsMargins(60, 48, 60, 40)
        cl.setSpacing(0)
        cl.setAlignment(Qt.AlignTop)

        # ── Logo + título ──
        logo_row = QHBoxLayout()
        logo_row.setAlignment(Qt.AlignCenter)
        logo_box = QLabel()
        logo_box.setFixedSize(52, 52)
        logo_box.setAlignment(Qt.AlignCenter)
        logo_box.setStyleSheet(
            "background: qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 #2563eb,stop:1 #1d4ed8);"
            "border-radius: 14px;"
        )
        logo_box.setText("🔒")
        logo_box.setFont(QFont("Segoe UI Emoji", 22))
        logo_row.addWidget(logo_box)
        cl.addLayout(logo_row)
        cl.addSpacing(20)

        title = QLabel("Activación de estación")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("color: #f1f5f9; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;")
        cl.addWidget(title)
        cl.addSpacing(6)

        subtitle = QLabel("Comparte el ID de esta máquina con el administrador.\nÉl la activará desde el panel web — no necesitas hacer nada más.")
        subtitle.setAlignment(Qt.AlignCenter)
        subtitle.setWordWrap(True)
        subtitle.setStyleSheet("color: #64748b; font-size: 12px; line-height: 1.6;")
        cl.addWidget(subtitle)
        cl.addSpacing(28)

        # ── HWID box ──
        hwid_card = QWidget()
        hwid_card.setStyleSheet(
            "background: #0a1428; border: 1px solid #1e3a5f;"
            "border-radius: 12px; padding: 0;"
        )
        hwid_lay = QVBoxLayout(hwid_card)
        hwid_lay.setContentsMargins(20, 16, 20, 16)
        hwid_lay.setSpacing(6)

        hwid_label = QLabel("ID DE ESTA MÁQUINA")
        hwid_label.setStyleSheet("color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 1.5px;")
        hwid_lay.addWidget(hwid_label)

        hwid_row = QHBoxLayout()
        hwid_row.setSpacing(8)

        self._hwid_display = QLineEdit(self._hwid)
        self._hwid_display.setReadOnly(True)
        self._hwid_display.setStyleSheet(
            "background: transparent; border: none; color: #60a5fa;"
            "font-size: 18px; font-weight: 700; font-family: 'Cascadia Code', 'Courier New', monospace;"
            "letter-spacing: 2px; selection-background-color: #2563eb;"
        )
        self._hwid_display.setFont(QFont("Cascadia Code", 18, QFont.Bold))
        hwid_row.addWidget(self._hwid_display, 1)

        self._copy_btn = QPushButton("Copiar")
        self._copy_btn.setFixedSize(72, 34)
        self._copy_btn.setCursor(Qt.PointingHandCursor)
        self._copy_btn.setStyleSheet(self._btn_style("#1e3a5f", "#2563eb", "#93c5fd"))
        self._copy_btn.clicked.connect(self._copy_hwid)
        hwid_row.addWidget(self._copy_btn)

        hwid_lay.addLayout(hwid_row)
        cl.addWidget(hwid_card)
        cl.addSpacing(24)

        # ── Estado del polling ──
        self._status_label = QLabel("⏳  Esperando activación desde el panel web...")
        self._status_label.setAlignment(Qt.AlignCenter)
        self._status_label.setStyleSheet("color: #475569; font-size: 13px;")
        cl.addWidget(self._status_label)
        cl.addSpacing(6)

        self._dot_label = QLabel("●  ●  ●")
        self._dot_label.setAlignment(Qt.AlignCenter)
        self._dot_label.setStyleSheet("color: #1e3a5f; font-size: 10px; letter-spacing: 4px;")
        cl.addWidget(self._dot_label)
        cl.addSpacing(20)

        # ── Separador ──
        sep = QWidget()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background: #0f1e35;")
        cl.addWidget(sep)
        cl.addSpacing(16)

        # ── API Key manual (colapsado por defecto) ──
        self._manual_toggle = QPushButton("¿Ya tienes una API Key? Ingrésala manualmente")
        self._manual_toggle.setFlat(True)
        self._manual_toggle.setCursor(Qt.PointingHandCursor)
        self._manual_toggle.setStyleSheet(
            "color: #334155; font-size: 11px; border: none; background: transparent;"
            "text-decoration: underline;"
        )
        self._manual_toggle.clicked.connect(self._toggle_manual)
        cl.addWidget(self._manual_toggle, 0, Qt.AlignCenter)

        self._manual_widget = QWidget()
        self._manual_widget.setVisible(False)
        ml = QVBoxLayout(self._manual_widget)
        ml.setContentsMargins(0, 12, 0, 0)
        ml.setSpacing(8)

        self._api_key_input = QLineEdit()
        self._api_key_input.setPlaceholderText("slm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        self._api_key_input.setStyleSheet(
            "background: #0a1428; border: 1px solid #1e293b; border-radius: 10px;"
            "padding: 10px 14px; color: #f1f5f9; font-size: 12px;"
            "font-family: 'Cascadia Code', monospace;"
        )
        ml.addWidget(self._api_key_input)

        self._manual_btn = QPushButton("Activar con esta API Key")
        self._manual_btn.setCursor(Qt.PointingHandCursor)
        self._manual_btn.setStyleSheet(self._btn_style("#1e3a5f", "#2563eb", "#f1f5f9", full=True))
        self._manual_btn.clicked.connect(self._activate_manual)
        ml.addWidget(self._manual_btn)

        cl.addWidget(self._manual_widget)
        cl.addStretch(1)

        # Footer
        footer = QLabel("Safe Link Monitoring  ·  Configuración de hardware")
        footer.setAlignment(Qt.AlignCenter)
        footer.setStyleSheet("color: #0f1e35; font-size: 10px; padding: 14px;")
        outer.addWidget(footer)

        # Animación de puntos
        self._dot_timer = QTimer(self)
        self._dot_timer.setInterval(600)
        self._dot_timer.timeout.connect(self._animate_dots)
        self._dot_timer.start()

    def _btn_style(self, bg, border, color, full=False):
        w = "100%" if full else "auto"
        return (
            f"background: {bg}; border: 1px solid {border}; border-radius: 8px;"
            f"color: {color}; font-size: 11px; font-weight: 700;"
            f"padding: 6px 14px;"
        )

    def _center(self):
        geo = QApplication.primaryScreen().geometry()
        self.move(
            geo.center().x() - self.width() // 2,
            geo.center().y() - self.height() // 2,
        )

    # ── Animación de puntos ───────────────────────────────────────────────────

    def _animate_dots(self):
        patterns = ["●  ○  ○", "○  ●  ○", "○  ○  ●", "○  ●  ○"]
        self._dots = (self._dots + 1) % len(patterns)
        self._dot_label.setText(patterns[self._dots])

    # ── Copiar HWID ───────────────────────────────────────────────────────────

    def _copy_hwid(self):
        QApplication.clipboard().setText(self._hwid)
        self._copy_btn.setText("✓ Copiado")
        self._copy_btn.setStyleSheet(self._btn_style("#052e16", "#22c55e", "#86efac"))
        QTimer.singleShot(2000, self._reset_copy_btn)

    def _reset_copy_btn(self):
        self._copy_btn.setText("Copiar")
        self._copy_btn.setStyleSheet(self._btn_style("#1e3a5f", "#2563eb", "#93c5fd"))

    # ── Manual toggle ─────────────────────────────────────────────────────────

    def _toggle_manual(self):
        self._manual_mode = not self._manual_mode
        self._manual_widget.setVisible(self._manual_mode)
        self._manual_toggle.setText(
            "Cancelar" if self._manual_mode
            else "¿Ya tienes una API Key? Ingrésala manualmente"
        )
        self.adjustSize()

    # ── Activación manual ─────────────────────────────────────────────────────

    def _activate_manual(self):
        key = self._api_key_input.text().strip()
        if not key.startswith("slm_") or len(key) < 20:
            self._api_key_input.setStyleSheet(
                self._api_key_input.styleSheet() + "border-color: #ef4444;"
            )
            return
        self._manual_btn.setText("Verificando...")
        self._manual_btn.setEnabled(False)
        QTimer.singleShot(100, lambda: self._verify_manual_key(key))

    def _verify_manual_key(self, key: str):
        try:
            from utils.supabase_client import get_supabase_client
            sb  = get_supabase_client()
            res = sb.rpc("station_heartbeat", {"p_api_key": key, "p_hwid": self._hwid}).execute()
            data = res.data
            if data and data.get("ok"):
                payload = {
                    "api_key":        key,
                    "dispositivo_id": data.get("dispositivo_id"),
                    "nombre":         data.get("nombre", "Estación"),
                    "empresa_id":     data.get("empresa_id"),
                    "sucursal_id":    data.get("sucursal_id"),
                }
                self._on_activated(payload)
            else:
                self._manual_btn.setText("API Key inválida — intenta de nuevo")
                self._manual_btn.setEnabled(True)
        except Exception as e:
            self._manual_btn.setText(f"Error: {str(e)[:40]}")
            self._manual_btn.setEnabled(True)

    # ── Polling silencioso ────────────────────────────────────────────────────

    def _start_polling(self):
        self._poll_thread = QThread(self)
        self._poller      = _ProvisioningPoller(self._hwid)
        self._poller.moveToThread(self._poll_thread)
        self._poll_thread.started.connect(self._poller.start)
        self._poller.activated.connect(self._on_activated)
        self._poll_thread.start()
        logger.info(f"Provisioning — HWID: {self._hwid} | polling cada 5s")

    def _stop_polling(self):
        if self._poller:
            self._poller.stop()
        if self._poll_thread and self._poll_thread.isRunning():
            self._poll_thread.quit()
            self._poll_thread.wait(2000)

    # ── Activación exitosa ────────────────────────────────────────────────────

    def _on_activated(self, data: dict):
        self._stop_polling()
        if self._dot_timer:
            self._dot_timer.stop()

        # Guardar configuración localmente
        _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        config = {
            "api_key":        data.get("api_key"),
            "dispositivo_id": data.get("dispositivo_id"),
            "nombre":         data.get("nombre", "Estación"),
            "empresa_id":     data.get("empresa_id"),
            "sucursal_id":    data.get("sucursal_id"),
            "hwid":           self._hwid,
        }
        _CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False), "utf-8")

        # También inyectar en os.environ para que el proceso actual lo vea
        os.environ["STATION_API_KEY"] = data.get("api_key", "")

        # UI — countdown
        self._dot_label.setStyleSheet("color: #22c55e; font-size: 14px; letter-spacing: 2px;")
        self._dot_label.setText("✓  Estación activada")
        self._status_label.setText(f"Iniciando: {data.get('nombre', 'Estación')}...")
        self._status_label.setStyleSheet("color: #86efac; font-size: 13px; font-weight: 700;")
        self._manual_widget.setVisible(False)
        self._manual_toggle.setVisible(False)

        logger.info(f"Estación activada: {data.get('nombre')} ({data.get('dispositivo_id')})")

        self._countdown = 3
        self._cd_timer  = QTimer(self)
        self._cd_timer.setInterval(1000)
        self._cd_timer.timeout.connect(self._countdown_tick)
        self._cd_timer.start()

    def _countdown_tick(self):
        self._countdown -= 1
        if self._countdown > 0:
            self._status_label.setText(f"Iniciando en {self._countdown}s...")
        else:
            self._cd_timer.stop()
            self.hide()
            QTimer.singleShot(0, self.provisioning_complete.emit)

    def show(self):
        self.setWindowOpacity(0.0)
        super().show()
        self._fade_step  = 0.0
        self._fade_timer = QTimer(self)
        self._fade_timer.timeout.connect(self._do_fade)
        self._fade_timer.start(16)

    def _do_fade(self):
        self._fade_step = min(self._fade_step + 0.07, 1.0)
        self.setWindowOpacity(self._fade_step)
        if self._fade_step >= 1.0:
            self._fade_timer.stop()

    def closeEvent(self, ev):
        self._stop_polling()
        ev.accept()
