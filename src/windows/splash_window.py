"""
Pantalla de carga profesional con animación de progreso.
"""

from PyQt5.QtWidgets import QSplashScreen, QApplication
from PyQt5.QtCore import Qt, QRect, QTimer
from PyQt5.QtGui import QPixmap, QFont, QPainter, QColor, QLinearGradient, QBrush, QPen


class SplashScreen(QSplashScreen):

    def __init__(self):
        self._progress = 0
        self._message = "Inicializando..."
        self._anim_timer = QTimer()
        self._anim_timer.timeout.connect(self._tick_progress)

        pixmap = QPixmap(800, 500)
        pixmap.fill(Qt.transparent)
        self._draw(pixmap)

        super().__init__(pixmap)
        self.setWindowFlags(
            Qt.WindowStaysOnTopHint | Qt.SplashScreen | Qt.FramelessWindowHint
        )

        # Auto-animate progress smoothly
        self._anim_timer.start(40)

    def _draw(self, pixmap):
        p = QPainter(pixmap)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = pixmap.width(), pixmap.height()

        # Background gradient
        bg = QLinearGradient(0, 0, w, h)
        bg.setColorAt(0, QColor(10, 15, 30))
        bg.setColorAt(0.5, QColor(17, 24, 39))
        bg.setColorAt(1, QColor(10, 15, 30))
        p.fillRect(pixmap.rect(), QBrush(bg))

        # Subtle accent glow top-right
        glow = QLinearGradient(w, 0, 0, h)
        glow.setColorAt(0, QColor(99, 102, 241, 25))
        glow.setColorAt(0.5, QColor(0, 0, 0, 0))
        p.fillRect(pixmap.rect(), QBrush(glow))

        # Decorative circle
        p.setPen(QPen(QColor(99, 102, 241, 40), 2))
        p.setBrush(QBrush(QColor(99, 102, 241, 12)))
        p.drawEllipse(w // 2 - 70, 100, 140, 140)
        p.setPen(QPen(QColor(99, 102, 241, 20), 1))
        p.drawEllipse(w // 2 - 90, 80, 180, 180)

        # Shield icon inside circle
        cx, cy = w // 2, 170
        p.setPen(QPen(QColor(165, 180, 252), 2.5))
        p.setBrush(Qt.NoBrush)
        pts = [
            (cx, cy - 28),
            (cx - 22, cy - 16),
            (cx - 22, cy + 8),
            (cx, cy + 28),
            (cx + 22, cy + 8),
            (cx + 22, cy - 16),
        ]
        from PyQt5.QtCore import QPoint
        from PyQt5.QtGui import QPolygon

        p.drawPolygon(QPolygon([QPoint(int(x), int(y)) for x, y in pts]))

        # Title
        font_title = QFont("Segoe UI", 36)
        font_title.setBold(True)
        p.setFont(font_title)
        p.setPen(QColor(255, 255, 255))
        p.drawText(QRect(0, 270, w, 50), Qt.AlignCenter, "SAFE LINK")

        # Subtitle
        font_sub = QFont("Segoe UI", 14)
        p.setFont(font_sub)
        p.setPen(QColor(148, 163, 184))
        p.drawText(
            QRect(0, 325, w, 30), Qt.AlignCenter, "Sistema de Control de Asistencia"
        )

        # Progress bar track
        bar_x, bar_y, bar_w, bar_h = 180, 400, w - 360, 6
        p.setPen(Qt.NoPen)
        p.setBrush(QColor(30, 41, 59))
        p.drawRoundedRect(bar_x, bar_y, bar_w, bar_h, 3, 3)

        # Progress bar fill
        fill_w = int(bar_w * min(self._progress / 100.0, 1.0))
        if fill_w > 0:
            pg = QLinearGradient(bar_x, 0, bar_x + bar_w, 0)
            pg.setColorAt(0, QColor(99, 102, 241))
            pg.setColorAt(1, QColor(139, 92, 246))
            p.setBrush(QBrush(pg))
            p.drawRoundedRect(bar_x, bar_y, fill_w, bar_h, 3, 3)

        # Message
        font_msg = QFont("Segoe UI", 10)
        p.setFont(font_msg)
        p.setPen(QColor(100, 116, 139))
        p.drawText(QRect(0, 420, w, 25), Qt.AlignCenter, self._message)

        # Version / branding
        font_v = QFont("Segoe UI", 8)
        p.setFont(font_v)
        p.setPen(QColor(55, 65, 81))
        p.drawText(QRect(0, h - 30, w, 20), Qt.AlignCenter, "Safe Link Monitoring v1.0")

        p.end()

    def _tick_progress(self):
        if self._progress < 80:
            self._progress += 1
            self._redraw()

    def _redraw(self):
        px = self.pixmap()
        px.fill(Qt.transparent)
        self._draw(px)
        self.setPixmap(px)

    def update_message(self, message: str):
        self._message = message
        self._progress = min(self._progress + 5, 95)
        self._redraw()
        QApplication.processEvents()

    def finish_loading(self):
        self._anim_timer.stop()
        self._progress = 100
        self._message = "Listo"
        self._redraw()
        QApplication.processEvents()
