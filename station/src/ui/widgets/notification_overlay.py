"""
NotificationOverlay — Temporary full-screen messages with auto-dismiss.
"""
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QLabel
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QFont, QPainter, QColor
from utils.design_tokens import SHARED, TOKENS


class NotificationOverlay(QWidget):
    """Semi-transparent overlay for "No Reconocido" / "Ya Registrado"."""

    __slots__ = ("_timer", "_icon_label", "_title_label", "_sub_label")

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)
        self.hide()

        lay = QVBoxLayout(self)
        lay.setAlignment(Qt.AlignCenter)

        self._icon_label = QLabel()
        self._icon_label.setAlignment(Qt.AlignCenter)
        self._icon_label.setStyleSheet("background: transparent; font-size: 48px;")
        lay.addWidget(self._icon_label, 0, Qt.AlignCenter)

        self._title_label = QLabel()
        self._title_label.setAlignment(Qt.AlignCenter)
        self._title_label.setFont(QFont(SHARED["font_ui"], TOKENS["font_xl"], QFont.Bold))
        self._title_label.setStyleSheet("background: transparent;")
        lay.addWidget(self._title_label, 0, Qt.AlignCenter)

        self._sub_label = QLabel()
        self._sub_label.setAlignment(Qt.AlignCenter)
        self._sub_label.setFont(QFont(SHARED["font_mono"], TOKENS["font_lg"]))
        self._sub_label.setStyleSheet("background: transparent;")
        lay.addWidget(self._sub_label, 0, Qt.AlignCenter)

        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self.hide)

    def show_not_recognized(self, duration_ms: int = 3000) -> None:
        self.setStyleSheet(
            f"background: rgba(153, 27, 27, 0.30); backdrop-filter: blur(8px);"
        )
        self._icon_label.setText("⚠")
        self._icon_label.setStyleSheet(f"color: {SHARED['danger']}; background: transparent; font-size: 48px;")
        self._title_label.setText("No Reconocido")
        self._title_label.setStyleSheet(f"color: {SHARED['danger']}; background: transparent;")
        self._sub_label.setText("")
        self.resize(self.parent().size())
        self.show()
        self._timer.start(duration_ms)

    def show_already_registered(self, tipo: str, hora: str,
                                duration_ms: int = 3000) -> None:
        self.setStyleSheet(
            f"background: rgba(133, 77, 14, 0.25); backdrop-filter: blur(8px);"
        )
        self._icon_label.setText("✓")
        self._icon_label.setStyleSheet(f"color: {SHARED['warning']}; background: transparent; font-size: 48px;")
        self._title_label.setText("Ya Registrado")
        self._title_label.setStyleSheet(f"color: {SHARED['warning']}; background: transparent;")
        self._sub_label.setText(f"{tipo.upper()} · {hora}")
        self._sub_label.setStyleSheet(f"color: {SHARED['text_dim']}; background: transparent;")
        self.resize(self.parent().size())
        self.show()
        self._timer.start(duration_ms)

    def paintEvent(self, _event) -> None:
        pass
