"""
AttendanceDialog — Premium attendance confirmation overlay.
"""
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QFont, QPainter, QColor, QPen, QPainterPath, QPixmap
from utils.design_tokens import SHARED, TOKENS


def _make_icon_pixmap(color_hex: str, is_check: bool, size: int = 48) -> QPixmap:
    px = QPixmap(size, size)
    px.fill(Qt.transparent)
    p = QPainter(px)
    p.setRenderHint(QPainter.Antialiasing)
    p.setPen(Qt.NoPen)
    p.setBrush(QColor(color_hex))
    p.drawEllipse(0, 0, size, size)

    pen = QPen(QColor(255, 255, 255, 230), 2.5, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin)
    p.setPen(pen)
    p.setBrush(Qt.NoBrush)
    cx, cy, s = size / 2.0, size / 2.0, size * 0.22

    if is_check:
        path = QPainterPath()
        path.moveTo(cx - s * 0.9, cy + s * 0.1)
        path.lineTo(cx - s * 0.1, cy + s * 0.85)
        path.lineTo(cx + s * 0.9, cy - s * 0.6)
        p.drawPath(path)
    else:
        path = QPainterPath()
        path.moveTo(cx - s * 0.7, cy)
        path.lineTo(cx + s * 0.5, cy)
        path2 = QPainterPath()
        path2.moveTo(cx + s * 0.5, cy)
        path2.lineTo(cx + s * 0.1, cy - s * 0.5)
        path2.moveTo(cx + s * 0.5, cy)
        path2.lineTo(cx + s * 0.1, cy + s * 0.5)
        p.drawPath(path)
        p.drawPath(path2)
    p.end()
    return px


class _ProgressBar(QWidget):
    __slots__ = ("_color",)

    def __init__(self, color: str, parent=None):
        super().__init__(parent)
        self._color = QColor(color)
        self.setFixedHeight(3)

    def paintEvent(self, _event) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        p.setBrush(QColor(255, 255, 255, 20))
        p.setPen(Qt.NoPen)
        p.drawRoundedRect(0, 0, w, h, h // 2, h // 2)
        p.setBrush(self._color)
        p.drawRoundedRect(0, 0, w, h, h // 2, h // 2)
        p.end()


class AttendanceDialog(QWidget):
    """Full-screen attendance overlay with avatar, name, countdown."""

    __slots__ = ("_count_timer", "_secs_left", "_count_label")

    def __init__(self, tipo: str, nombre: str, confianza: float,
                 hora: str, avatar_b64: str = "", parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_DeleteOnClose)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)

        if parent:
            self.setGeometry(parent.rect())

        is_entrada = tipo.upper() == "ENTRADA"
        accent = SHARED["success"] if is_entrada else SHARED["accent"]

        bg = "rgba(10, 40, 20, 0.92)" if is_entrada else "rgba(10, 20, 40, 0.92)"
        self.setStyleSheet(f"background: {bg}; border: none;")

        lay = QVBoxLayout(self)
        lay.setAlignment(Qt.AlignCenter)
        lay.setSpacing(TOKENS["spacing_lg"])

        # Icon
        icon_lbl = QLabel()
        icon_lbl.setFixedSize(48, 48)
        icon_lbl.setAlignment(Qt.AlignCenter)
        icon_lbl.setStyleSheet("background: transparent;")
        icon_lbl.setPixmap(_make_icon_pixmap(accent, is_check=is_entrada, size=48))
        lay.addWidget(icon_lbl, 0, Qt.AlignCenter)

        # Type label
        tipo_lbl = QLabel(f"{tipo.upper()} REGISTRADA")
        tipo_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_3xl"], QFont.Bold))
        tipo_lbl.setAlignment(Qt.AlignCenter)
        tipo_lbl.setStyleSheet(f"color: {accent}; background: transparent;")
        lay.addWidget(tipo_lbl)

        # Name
        name_lbl = QLabel(nombre)
        name_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_hero"], QFont.Bold))
        name_lbl.setAlignment(Qt.AlignCenter)
        name_lbl.setStyleSheet(f"color: {SHARED['text_primary']}; background: transparent;")
        lay.addWidget(name_lbl)

        # Info row: confianza + hora
        info_row = QHBoxLayout()
        info_row.setAlignment(Qt.AlignCenter)
        info_row.setSpacing(TOKENS["spacing_xl"])

        conf_lbl = QLabel(f"Confianza: {confianza:.0f}%")
        conf_lbl.setFont(QFont(SHARED["font_mono"], TOKENS["font_lg"], QFont.Bold))
        conf_lbl.setStyleSheet(f"color: {accent}; background: transparent;")
        info_row.addWidget(conf_lbl)

        sep = QLabel("·")
        sep.setFont(QFont(SHARED["font_ui"], TOKENS["font_xl"]))
        sep.setStyleSheet(f"color: {SHARED['text_dim']}; background: transparent;")
        info_row.addWidget(sep)

        hora_lbl = QLabel(hora)
        hora_lbl.setFont(QFont(SHARED["font_mono"], TOKENS["font_lg"], QFont.Bold))
        hora_lbl.setStyleSheet(f"color: {SHARED['text_secondary']}; background: transparent;")
        info_row.addWidget(hora_lbl)
        lay.addLayout(info_row)

        lay.addSpacing(TOKENS["spacing_md"])

        # Countdown bar
        bar = _ProgressBar(accent, self)
        bar.setFixedWidth(240)
        lay.addWidget(bar, 0, Qt.AlignCenter)

        # Countdown label
        self._secs_left = 4
        self._count_label = QLabel(f"Cerrando en {self._secs_left}s")
        self._count_label.setFont(QFont(SHARED["font_mono"], TOKENS["font_md"], QFont.Bold))
        self._count_label.setAlignment(Qt.AlignCenter)
        self._count_label.setStyleSheet(
            f"color: {SHARED['text_dim']}; background: transparent;"
        )
        lay.addWidget(self._count_label)

        self._count_timer = QTimer(self)
        self._count_timer.timeout.connect(self._update_countdown)
        self._count_timer.start(1000)

    def _update_countdown(self) -> None:
        self._secs_left -= 1
        if self._secs_left > 0:
            self._count_label.setText(f"Cerrando en {self._secs_left}s")
        else:
            self._count_timer.stop()
            self.close()
