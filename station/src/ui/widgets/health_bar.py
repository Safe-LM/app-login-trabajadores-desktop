"""
HealthBar — System health indicator with gradient bar + sub-metrics.
"""
from PyQt5.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel, QWidget
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont, QPainter, QColor, QLinearGradient, QBrush
from utils.design_tokens import SHARED, TOKENS


class _GradientProgress(QWidget):
    __slots__ = ("_value", "_color")

    def __init__(self, parent=None):
        super().__init__(parent)
        self._value = 0
        self._color = SHARED["success"]
        self.setFixedHeight(6)
        self.setStyleSheet("background: transparent;")

    def set_value(self, val: int, color: str) -> None:
        self._value = max(0, min(100, val))
        self._color = color
        self.update()

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        p.setBrush(QColor(255, 255, 255, 15))
        p.setPen(Qt.NoPen)
        p.drawRoundedRect(0, 0, w, h, h // 2, h // 2)
        if self._value > 0:
            fill_w = int(w * self._value / 100)
            grad = QLinearGradient(0, 0, fill_w, 0)
            grad.setColorAt(0, QColor(self._color).lighter(140))
            grad.setColorAt(0.5, QColor(self._color))
            grad.setColorAt(1, QColor(self._color).darker(120))
            p.setBrush(QBrush(grad))
            p.drawRoundedRect(0, 0, fill_w, h, h // 2, h // 2)
        p.end()


class HealthBar(QFrame):
    __slots__ = ("_score_label", "_bar", "_metric_labels")

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet(
            f"background:{SHARED['bg_surface']};border:1px solid {SHARED['border']};"
            f"border-radius:{TOKENS['radius_lg']}px;"
        )
        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 12, 14, 12)
        lay.setSpacing(TOKENS["spacing_sm"])

        header = QHBoxLayout()
        title = QLabel("SALUD DEL SISTEMA")
        title.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 1, QFont.Bold))
        title.setStyleSheet(
            f"color:{SHARED['text_muted']};background:transparent;letter-spacing:2px;"
        )
        header.addWidget(title)
        header.addStretch()
        self._score_label = QLabel("--/100")
        self._score_label.setFont(QFont(SHARED["font_mono"], TOKENS["font_sm"], QFont.Bold))
        self._score_label.setStyleSheet("background:transparent;")
        header.addWidget(self._score_label)
        lay.addLayout(header)

        self._bar = _GradientProgress(self)
        lay.addWidget(self._bar)

        metrics_frame = QFrame()
        metrics_frame.setStyleSheet("background:transparent;border:none;")
        metrics_lay = QHBoxLayout(metrics_frame)
        metrics_lay.setContentsMargins(0, 0, 0, 0)
        metrics_lay.setSpacing(TOKENS["spacing_sm"])

        self._metric_labels = []
        for label_text in ("Camara", "Empleados", "Encodings"):
            box = QFrame()
            box.setStyleSheet(
                f"background:{SHARED['bg_surface_hover']};border:1px solid {SHARED['border']};"
                f"border-radius:{TOKENS['radius_sm']}px;"
            )
            bl = QVBoxLayout(box)
            bl.setContentsMargins(8, 4, 8, 4)
            bl.setSpacing(0)
            lbl = QLabel(label_text.upper())
            lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 2, QFont.Bold))
            lbl.setStyleSheet(f"color:{SHARED['text_muted']};background:transparent;")
            bl.addWidget(lbl)
            val = QLabel("--")
            val.setFont(QFont(SHARED["font_mono"], TOKENS["font_sm"], QFont.Bold))
            val.setStyleSheet("background:transparent;")
            bl.addWidget(val)
            self._metric_labels.append(val)
            metrics_lay.addWidget(box)

        lay.addWidget(metrics_frame)

    def update_health(self, score: int, camara_ok, empleados: int, encodings: int) -> None:
        color = SHARED["success"] if score >= 80 else (
            SHARED["warning"] if score >= 40 else SHARED["danger"]
        )
        self._score_label.setText(f"{score}/100")
        self._score_label.setStyleSheet(f"color:{color};background:transparent;")
        self._bar.set_value(score, color)

        cam_text = "OK" if camara_ok is True else ("Error" if camara_ok is False else "--")
        cam_color = SHARED["success"] if camara_ok else (SHARED["danger"] if camara_ok is False else SHARED["text_muted"])
        self._metric_labels[0].setText(cam_text)
        self._metric_labels[0].setStyleSheet(f"color:{cam_color};background:transparent;")

        self._metric_labels[1].setText(str(empleados))
        emp_color = SHARED["success"] if empleados > 0 else SHARED["text_muted"]
        self._metric_labels[1].setStyleSheet(f"color:{emp_color};background:transparent;")

        self._metric_labels[2].setText("Listo" if encodings > 0 else "--")
        enc_color = SHARED["success"] if encodings > 0 else SHARED["text_muted"]
        self._metric_labels[2].setStyleSheet(f"color:{enc_color};background:transparent;")
