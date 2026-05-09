"""
ConfidenceRing — Circular arc + percentage display.
"""
from PyQt5.QtWidgets import QWidget, QSizePolicy
from PyQt5.QtCore import Qt, QRectF
from PyQt5.QtGui import (
    QPainter, QPen, QColor, QFont, QPainterPath,
)
from utils.design_tokens import SHARED, TOKENS


class ConfidenceRing(QWidget):
    """Animated circular confidence gauge with percentage text."""

    __slots__ = ("_pct", "_color")

    def __init__(self, parent=None, size: int = 140):
        super().__init__(parent)
        self._pct: float = -1.0
        self._color: QColor = QColor(SHARED["text_muted"])
        self.setFixedSize(size, size)
        self.setSizePolicy(QSizePolicy.Fixed, QSizePolicy.Fixed)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)
        self.setStyleSheet("background: transparent;")

    def set_value(self, pct: float, color_hex: str = "") -> None:
        self._pct = max(0.0, min(100.0, pct))
        if color_hex:
            self._color = QColor(color_hex)
        self.update()

    def reset(self) -> None:
        self._pct = -1.0
        self._color = QColor(SHARED["text_muted"])
        self.update()

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)

        w, h = self.width(), self.height()
        margin = 12
        r = min(w, h) // 2 - margin
        cx, cy = w // 2, h // 2

        # Track ring (background arc)
        track_pen = QPen(QColor(255, 255, 255, 18), 6, Qt.SolidLine, Qt.RoundCap)
        p.setPen(track_pen)
        p.setBrush(Qt.NoBrush)
        p.drawEllipse(QRectF(cx - r, cy - r, 2 * r, 2 * r))

        # Value arc (clockwise from 12 o'clock)
        if self._pct >= 0:
            arc_color = QColor(self._color)
            arc_color.setAlpha(220)
            arc_pen = QPen(arc_color, 6, Qt.SolidLine, Qt.RoundCap)
            p.setPen(arc_pen)
            span = int(self._pct / 100.0 * 360 * 16)
            p.drawArc(QRectF(cx - r, cy - r, 2 * r, 2 * r), 90 * 16, -span)

        # Center text
        txt = f"{self._pct:.0f}%" if self._pct >= 0 else "--"
        font_sz = 22 if self._pct >= 0 else 26
        p.setPen(QPen(self._color))
        p.setFont(QFont(SHARED["font_mono"], font_sz, QFont.Bold))
        rect = QRectF(0, 0, w, h)
        p.drawText(rect, Qt.AlignCenter, txt)

        p.end()
