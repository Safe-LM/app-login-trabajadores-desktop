"""
StatusBadge — Pulsing dot + label indicator.
"""
from PyQt5.QtWidgets import QWidget, QHBoxLayout, QLabel
from PyQt5.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, pyqtProperty
from PyQt5.QtGui import QColor
from utils.design_tokens import SHARED, TOKENS


class _PulsingDot(QLabel):
    """Circle that pulses (opacity) when active."""
    __slots__ = ("_opacity", "_anim")

    def __init__(self, color: str, size: int = 7):
        super().__init__()
        self._opacity: float = 1.0
        self.setFixedSize(size, size)
        self.setStyleSheet(
            f"background: {color}; border-radius: {size // 2}px;"
        )

    def _get_opacity(self) -> float:
        return self._opacity

    def _set_opacity(self, val: float) -> None:
        self._opacity = val
        palette = self.palette()
        c = QColor(SHARED["success"])
        c.setAlphaF(val)
        self.setStyleSheet(
            f"background: rgba({c.red()},{c.green()},{c.blue()},{val:.1f}); "
            f"border-radius: 3px;"
        )

    opacity = pyqtProperty(float, _get_opacity, _set_opacity)


class StatusBadge(QWidget):
    """Badge showing a colored dot + label text. Pulses when active."""

    __slots__ = ("_dot", "_label", "_pulse_timer", "_pulse_anim")

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)

        self._dot = QLabel()
        self._dot.setFixedSize(7, 7)
        self._dot.setStyleSheet(
            f"background: {SHARED['success']}; border-radius: 3px;"
        )
        lay.addWidget(self._dot)

        self._label = QLabel("OFFLINE")
        self._label.setStyleSheet(
            f"color: {SHARED['text_muted']}; background: transparent; "
            f"font-size: {TOKENS['font_xs']}px; font-weight: 700; letter-spacing: 1px;"
        )
        lay.addWidget(self._label)

        self._pulse_timer = QTimer(self)
        self._pulse_timer.setInterval(800)
        self._pulse_timer.timeout.connect(self._toggle_pulse)
        self._pulsing = False

    def set_online(self, text: str = "EN VIVO", color: str = SHARED["success"]) -> None:
        self._dot.setStyleSheet(
            f"background: {color}; border-radius: 3px;"
        )
        self._label.setText(text.upper())
        self._label.setStyleSheet(
            f"color: {color}; background: transparent; "
            f"font-size: {TOKENS['font_xs']}px; font-weight: 700; letter-spacing: 1px;"
        )
        self._pulse_timer.start()
        self._dot.show()

    def set_offline(self, text: str = "OFFLINE") -> None:
        self._pulse_timer.stop()
        self._dot.setStyleSheet(
            f"background: {SHARED['text_muted']}; border-radius: 3px; opacity: 1;"
        )
        self._label.setText(text.upper())
        self._label.setStyleSheet(
            f"color: {SHARED['text_muted']}; background: transparent; "
            f"font-size: {TOKENS['font_xs']}px; font-weight: 700; letter-spacing: 1px;"
        )

    def set_warning(self, text: str) -> None:
        self._dot.setStyleSheet(
            f"background: {SHARED['warning']}; border-radius: 3px;"
        )
        self._label.setText(text.upper())
        self._label.setStyleSheet(
            f"color: {SHARED['warning']}; background: transparent; "
            f"font-size: {TOKENS['font_xs']}px; font-weight: 700; letter-spacing: 1px;"
        )
        self._pulse_timer.stop()
        self._dot.show()

    def hide_dot(self) -> None:
        self._pulse_timer.stop()
        self._dot.hide()

    def _toggle_pulse(self) -> None:
        self._dot.setVisible(not self._dot.isVisible())
