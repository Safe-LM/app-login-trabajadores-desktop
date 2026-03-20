"""
Ventana de login – Safe Link Monitoring.
Diseño oscuro profesional de nivel empresarial.
"""

import sys
from pathlib import Path
from PyQt5.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
    QGraphicsDropShadowEffect,
    QSizePolicy,
    QAbstractButton,
)
from PyQt5.QtCore import (
    Qt,
    QTimer,
    QPropertyAnimation,
    QVariantAnimation,
    QEasingCurve,
    QRect,
    QSize,
    QRectF,
)
from PyQt5.QtGui import (
    QFont,
    QPalette,
    QColor,
    QPixmap,
    QPainter,
    QLinearGradient,
    QRadialGradient,
    QBrush,
    QPen,
    QPainterPath,
    QFontMetrics,
    QIcon,
)
from utils.auth import authenticate_user

_BASE_DIR = Path(__file__).resolve().parent.parent

# ── Design tokens ────────────────────────────────────────────────────
_C = {
    "bg": "#0a0f1a",
    "panel": "#0f1525",
    "card": "#0f172a",        # Ligeramente más oscuro para contrastar con el panel
    "card_alt": "#111827",
    "input_bg": "#0c1428",
    "border": "#1e293b",
    "border_hl": "#334155",
    # Enterprise blue — reemplaza indigo (anti-pattern "AI purple" según skill)
    "accent": "#2563eb",
    "accent_dk": "#1d4ed8",
    "accent_lt": "#60a5fa",
    "accent_glow": "#2563eb45",
    "success": "#22c55e",
    "error": "#ef4444",
    "error_bg": "#1a0a0a",
    "error_brd": "#7f1d1d",
    "text": "#f1f5f9",
    "text2": "#e2e8f0",
    "dim": "#94a3b8",
    "muted": "#64748b",
    "faint": "#475569",
}
_FF = "Segoe UI"


def _f(size, bold=False, weight=None):
    f = QFont(_FF, size)
    if bold:
        f.setBold(True)
    if weight is not None:
        f.setWeight(weight)
    return f


def _glow(color="#000", blur=24, ox=0, oy=4, parent=None):
    e = QGraphicsDropShadowEffect(parent)
    e.setColor(QColor(color))
    e.setBlurRadius(blur)
    e.setOffset(ox, oy)
    return e


# =====================================================================
#  Helper: lock icon pixmap (dibujado con QPainter, sin emojis)
# =====================================================================

def _make_lock_px(sz: int = 16, alpha: int = 220) -> QPixmap:
    """Candado vectorial blanco semitransparente para el botón de login."""
    px = QPixmap(sz, sz)
    px.fill(Qt.transparent)
    p = QPainter(px)
    p.setRenderHint(QPainter.Antialiasing)
    col = QColor(255, 255, 255, alpha)
    p.setPen(QPen(col, 1.4, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
    p.setBrush(Qt.NoBrush)
    # Cuerpo del candado
    bx, by = sz * 0.18, sz * 0.46
    bw, bh = sz * 0.64, sz * 0.47
    p.drawRoundedRect(QRectF(bx, by, bw, bh), 2.2, 2.2)
    # Arco superior
    p.drawArc(QRectF(sz * 0.28, sz * 0.08, sz * 0.44, sz * 0.52), 0, 180 * 16)
    # Punto central (cerradura)
    p.setBrush(col)
    p.setPen(Qt.NoPen)
    r = sz * 0.11
    p.drawEllipse(QRectF(sz / 2 - r, sz * 0.57, r * 2, r * 2))
    p.end()
    return px


# =====================================================================
#  Shield animado — pulse ring via QTimer + QPainter
# =====================================================================

class _ShieldWidget(QWidget):
    """Widget que dibuja el escudo con dos anillos de pulso animados."""

    def __init__(self, shield_px: QPixmap, parent=None):
        super().__init__(parent)
        self._px = shield_px
        self._phase = 0.0
        sz = shield_px.width() + 30
        self.setFixedSize(sz, sz)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setStyleSheet("background:transparent;")
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(42)   # ~24 fps — suave sin quemar CPU

    def _tick(self):
        self._phase = (self._phase + 0.013) % 1.0
        self.update()

    def paintEvent(self, ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        cx, cy = w / 2.0, h / 2.0

        # Dos anillos escalonados (fase 0 y 0.5)
        for offset in (0.0, 0.5):
            phase = (self._phase + offset) % 1.0
            r = phase * cx * 0.88 + cx * 0.22
            alpha = int(max(0.0, (1.0 - phase) ** 1.6 * 85))
            p.setPen(QPen(QColor(37, 99, 235, alpha), 1.3))
            p.setBrush(Qt.NoBrush)
            p.drawEllipse(QRectF(cx - r, cy - r, r * 2, r * 2))

        # Escudo centrado
        sx = int(cx - self._px.width() / 2)
        sy = int(cy - self._px.height() / 2)
        p.drawPixmap(sx, sy, self._px)
        p.end()


# =====================================================================
#  Card Frame — con top accent stripe pintado encima
# =====================================================================

class _CardFrame(QFrame):
    """QFrame con una franja gradient azul de 3px en la parte superior."""

    def paintEvent(self, ev):
        super().paintEvent(ev)
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w = self.width()

        # Gradient stripe: transparente → azul → celeste → transparente
        grad = QLinearGradient(0, 0, w, 0)
        grad.setColorAt(0.00, QColor(37, 99, 235, 0))
        grad.setColorAt(0.20, QColor(37, 99, 235, 220))
        grad.setColorAt(0.75, QColor(96, 165, 250, 180))
        grad.setColorAt(1.00, QColor(37, 99, 235, 0))

        # Clip a los 4px superiores respetando el border-radius del card
        clip = QPainterPath()
        clip.addRect(QRectF(0, 0, w, 4))
        rounded = QPainterPath()
        rounded.addRoundedRect(QRectF(0, 0, w, 4), 16, 16)
        p.setClipPath(clip.intersected(rounded))
        p.setPen(Qt.NoPen)
        p.fillRect(0, 0, w, 4, QBrush(grad))
        p.setClipping(False)
        p.end()


# =====================================================================
#  Login Button — con lock icon + spinner animado durante auth
# =====================================================================

class _LoginButton(QPushButton):
    """Botón con candado vectorial y spinner animado al verificar."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._spinning = False
        self._angle = 0
        self._lock_px = None
        self._spin_timer = QTimer(self)
        self._spin_timer.timeout.connect(self._tick_spin)

    def set_lock_icon(self, px: QPixmap):
        self._lock_px = px
        self.setIcon(QIcon(px))
        self.setIconSize(QSize(15, 15))

    def start_spin(self):
        self._spinning = True
        self._angle = 0
        self.setIcon(QIcon())          # ocultar lock mientras gira
        self._spin_timer.start(22)     # ~45 fps
        self.update()

    def stop_spin(self):
        self._spinning = False
        self._spin_timer.stop()
        if self._lock_px:
            self.setIcon(QIcon(self._lock_px))
        self.update()

    def _tick_spin(self):
        self._angle = (self._angle + 9) % 360
        self.update()

    def paintEvent(self, ev):
        super().paintEvent(ev)
        if not self._spinning:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        sz = 15
        x = self.width() - 30
        y = (self.height() - sz) // 2
        p.setPen(QPen(QColor(255, 255, 255, 200), 2.2, Qt.SolidLine, Qt.RoundCap))
        p.setBrush(Qt.NoBrush)
        p.drawArc(QRectF(x, y, sz, sz), self._angle * 16, 260 * 16)
        p.end()


# =====================================================================
#  Right panel — fondo decorativo (dot grid + ambient glow)
# =====================================================================
class _RightPanel(QWidget):
    """Panel derecho con dot grid sutil y radial glow detrás del card."""

    def paintEvent(self, ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()

        # Base background
        p.fillRect(self.rect(), QColor(_C["bg"]))

        # Radial ambient glow centrado — ancla el card visualmente
        cx, cy = w / 2, h / 2
        radius = min(w, h) * 0.55
        glow = QRadialGradient(cx, cy, radius)
        glow.setColorAt(0.0, QColor(37, 99, 235, 22))   # enterprise blue suave
        glow.setColorAt(0.55, QColor(37, 99, 235, 8))
        glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.fillRect(self.rect(), QBrush(glow))

        # Segundo glow en esquina inferior derecha (profundidad)
        glow2 = QRadialGradient(w * 0.85, h * 0.9, min(w, h) * 0.35)
        glow2.setColorAt(0.0, QColor(99, 102, 241, 12))
        glow2.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.fillRect(self.rect(), QBrush(glow2))

        # Dot grid sutil (estilo Linear / Vercel)
        dot_spacing = 28
        p.setPen(QPen(QColor(255, 255, 255, 16), 1.2))
        for x in range(0, w + dot_spacing, dot_spacing):
            for y in range(0, h + dot_spacing, dot_spacing):
                p.drawPoint(x, y)

        # Borde izquierdo con gradient para separación suave del brand panel
        edge = QLinearGradient(0, 0, 1, 0)
        edge.setColorAt(0.0, QColor(37, 99, 235, 30))
        edge.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.fillRect(0, 0, 2, h, QBrush(edge))

        p.end()


# =====================================================================
#  Main window
# =====================================================================
class LoginWindow(QMainWindow):

    def __init__(self):
        super().__init__()
        self.current_user = None
        self._busy = False
        self._init_ui()

    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring")
        self.setMinimumSize(1020, 680)
        self.resize(1160, 760)
        self.setStyleSheet(f"QMainWindow{{background:{_C['bg']}}}")

        pal = QPalette()
        pal.setColor(QPalette.Window, QColor(_C["bg"]))
        pal.setColor(QPalette.WindowText, QColor(_C["text"]))
        self.setPalette(pal)

        root = QWidget()
        self.setCentralWidget(root)
        rl = QHBoxLayout(root)
        rl.setSpacing(0)
        rl.setContentsMargins(0, 0, 0, 0)

        rl.addWidget(_BrandPanel(), 3)

        # ── Right side — panel decorativo ────────────────────────────
        right = _RightPanel()
        self._rv = QVBoxLayout(right)
        rv = self._rv
        rv.setContentsMargins(0, 0, 0, 0)
        rv.addStretch(2)

        # Card wrapper — _CardFrame pinta la stripe azul en el top
        card = _CardFrame()
        card.setMaximumWidth(420)
        card.setStyleSheet(f"""
            QFrame#loginCard {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #111827, stop:1 {_C['card']});
                border: 1px solid rgba(37, 99, 235, 0.30);
                border-radius: 16px;
            }}
        """)
        card.setObjectName("loginCard")
        card.setGraphicsEffect(_glow(_C["accent_glow"], 55, 0, 10))
        self._login_card = card
        cl = QVBoxLayout(card)
        cl.setContentsMargins(36, 36, 36, 32)
        cl.setSpacing(0)

        # Shield animado con pulse ring
        shield_w = _ShieldWidget(self._shield(60))
        shield_w.setStyleSheet("background:transparent;")
        cl.addWidget(shield_w, 0, Qt.AlignCenter)
        cl.addSpacing(14)

        # Title — ExtraBold (80) para presencia enterprise
        t = QLabel("Bienvenido de nuevo")
        t.setFont(_f(24, weight=80))
        t.setAlignment(Qt.AlignCenter)
        t.setStyleSheet(f"color:{_C['text']};background:transparent;")
        cl.addWidget(t)

        s = QLabel("Ingresa tus credenciales para continuar")
        s.setFont(_f(11))
        s.setAlignment(Qt.AlignCenter)
        s.setStyleSheet(f"color:{_C['dim']};background:transparent;")
        cl.addWidget(s)
        cl.addSpacing(28)

        # Error
        self._err_frame = self._mk_error()
        cl.addWidget(self._err_frame)

        # Username
        cl.addWidget(self._lbl("USUARIO"))
        cl.addSpacing(4)
        self.username_input = _IconInput("Ingresa tu usuario", "user")
        cl.addWidget(self.username_input)
        cl.addSpacing(16)

        # Password
        cl.addWidget(self._lbl("CONTRASEÑA"))
        cl.addSpacing(4)
        self._pw_row = _PasswordRow("Ingresa tu contraseña")
        self.password_input = self._pw_row.input
        cl.addWidget(self._pw_row)
        cl.addSpacing(24)

        # Botón con lock icon vectorial + spinner durante auth
        self.login_btn = _LoginButton()
        self.login_btn.setText("INICIAR SESIÓN")
        self.login_btn.setFont(_f(12, True))
        self.login_btn.setCursor(Qt.PointingHandCursor)
        self.login_btn.setFixedHeight(50)
        self.login_btn.setStyleSheet(self._btn_css())
        self.login_btn.setGraphicsEffect(_glow(_C["accent_glow"], 30, 0, 6))
        self.login_btn.set_lock_icon(_make_lock_px(15))
        self.login_btn.clicked.connect(self._on_login)
        cl.addWidget(self.login_btn)

        self.password_input.returnPressed.connect(self._on_login)
        self.username_input.returnPressed.connect(self.password_input.setFocus)

        cl.addSpacing(20)

        # Separador con tinte accent
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background: rgba(37, 99, 235, 0.20);")
        cl.addWidget(sep)
        cl.addSpacing(14)

        # Pill badge DEV + credenciales en una sola línea limpia
        creds_row = QHBoxLayout()
        creds_row.setSpacing(10)

        dev_badge = QLabel("DEV")
        dev_badge.setFont(_f(7, True))
        dev_badge.setAlignment(Qt.AlignCenter)
        dev_badge.setStyleSheet(f"""
            color: {_C['accent_lt']};
            background: rgba(37, 99, 235, 0.12);
            border: 1px solid rgba(37, 99, 235, 0.28);
            border-radius: 4px;
            padding: 2px 7px;
        """)
        creds_row.addWidget(dev_badge, 0, Qt.AlignVCenter)

        creds = QLabel("admin  ·  admin123")
        creds.setFont(_f(10))
        creds.setStyleSheet(f"color:{_C['text2']};background:transparent;")
        creds.setTextInteractionFlags(Qt.TextSelectableByMouse)
        creds_row.addWidget(creds)
        creds_row.addStretch()
        cl.addLayout(creds_row)

        # Version badge — bottom-right del card
        ver_row = QHBoxLayout()
        ver_row.addStretch()
        ver_lbl = QLabel("v2.0.4")
        ver_lbl.setFont(_f(7))
        ver_lbl.setStyleSheet(f"color:{_C['faint']};background:transparent;")
        ver_row.addWidget(ver_lbl)
        cl.addSpacing(6)
        cl.addLayout(ver_row)

        rv.addWidget(card, 0, Qt.AlignCenter)
        rv.addStretch(3)

        footer = QLabel("© 2026 Safe Link Monitoring — Todos los derechos reservados")
        footer.setFont(_f(8))
        footer.setAlignment(Qt.AlignCenter)
        footer.setStyleSheet(
            "color:#64748b;background:transparent;padding:12px;"  # contraste 4.5:1+
        )
        rv.addWidget(footer)

        rl.addWidget(right, 2)

    # ── Helpers ───────────────────────────────────────────────────────

    def _lbl(self, txt):
        l = QLabel(txt)
        l.setFont(_f(8, True))
        l.setStyleSheet(f"color:{_C['muted']};background:transparent;")
        return l

    def _mk_error(self):
        f = QFrame()
        f.setStyleSheet(f"""
            QFrame {{
                background:{_C['error_bg']};
                border:1px solid {_C['error_brd']};
                border-radius:8px;
            }}
        """)
        lay = QHBoxLayout(f)
        lay.setContentsMargins(12, 8, 12, 8)
        lay.setSpacing(8)
        ic = QLabel()
        ic.setPixmap(self._error_icon(16))
        ic.setStyleSheet("background:transparent;")
        lay.addWidget(ic)
        self._err_lbl = QLabel()
        self._err_lbl.setFont(_f(10))
        self._err_lbl.setWordWrap(True)
        self._err_lbl.setStyleSheet(f"color:#fca5a5;background:transparent;")
        lay.addWidget(self._err_lbl, 1)
        f.setVisible(False)
        return f

    def _error_icon(self, sz):
        px = QPixmap(sz, sz)
        px.fill(Qt.transparent)
        p = QPainter(px)
        p.setRenderHint(QPainter.Antialiasing)
        p.setPen(QPen(QColor(_C["error"]), 1.6, Qt.SolidLine, Qt.RoundCap))
        p.setBrush(Qt.NoBrush)
        m = 1.5
        p.drawEllipse(QRectF(m, m, sz - m * 2, sz - m * 2))
        cx = sz / 2
        p.drawLine(int(cx), int(sz * 0.25), int(cx), int(sz * 0.55))
        p.setBrush(QColor(_C["error"]))
        p.setPen(Qt.NoPen)
        p.drawEllipse(QRectF(cx - 1.5, sz * 0.66, 3, 3))
        p.end()
        return px

    def _show_err(self, msg):
        self._err_lbl.setText(msg)
        self._err_frame.setVisible(True)
        QTimer.singleShot(5000, self._hide_err)

    def _hide_err(self):
        self._err_frame.setVisible(False)

    def _btn_css(self):
        return f"""
            QPushButton {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 {_C['accent']}, stop:1 {_C['accent_dk']});
                color: white; border: none; border-radius: 10px;
                padding: 12px 0;
            }}
            QPushButton:hover {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 {_C['accent_lt']}, stop:1 {_C['accent']});
            }}
            QPushButton:pressed {{ background: #1e40af; }}
            QPushButton:disabled {{
                background: {_C['border']}; color: {_C['muted']};
            }}
        """

    # ── Shield ────────────────────────────────────────────────────────

    def _shield(self, sz):
        px = QPixmap(sz, sz)
        px.fill(Qt.transparent)
        p = QPainter(px)
        p.setRenderHint(QPainter.Antialiasing)
        cx, cy, s = sz / 2, sz / 2, sz * 0.42

        gl = QRadialGradient(cx, cy, sz * 0.48)
        gl.setColorAt(0, QColor(37, 99, 235, 40))   # enterprise blue glow
        gl.setColorAt(1, QColor(0, 0, 0, 0))
        p.setBrush(QBrush(gl))
        p.setPen(Qt.NoPen)
        p.drawEllipse(0, 0, sz, sz)

        path = self._shield_path(cx, cy, s)
        g = QLinearGradient(cx, cy - s, cx, cy + s)
        g.setColorAt(0, QColor(_C["accent_lt"]))
        g.setColorAt(1, QColor(_C["accent_dk"]))
        p.setBrush(QBrush(g))
        p.setPen(QPen(QColor(147, 197, 253, 110), 1))  # blue-300 tint
        p.drawPath(path)

        p.setPen(
            QPen(
                QColor(255, 255, 255, 220), 2.6, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin
            )
        )
        p.setBrush(Qt.NoBrush)
        ck = QPainterPath()
        ck.moveTo(cx - s * 0.28, cy + s * 0.05)
        ck.lineTo(cx - s * 0.05, cy + s * 0.3)
        ck.lineTo(cx + s * 0.32, cy - s * 0.22)
        p.drawPath(ck)
        p.end()
        return px

    @staticmethod
    def _shield_path(cx, cy, s):
        p = QPainterPath()
        p.moveTo(cx, cy - s)
        p.cubicTo(
            cx - s * 0.7,
            cy - s * 0.8,
            cx - s * 0.95,
            cy - s * 0.3,
            cx - s * 0.85,
            cy + s * 0.3,
        )
        p.quadTo(cx - s * 0.3, cy + s * 0.95, cx, cy + s * 1.05)
        p.quadTo(cx + s * 0.3, cy + s * 0.95, cx + s * 0.85, cy + s * 0.3)
        p.cubicTo(cx + s * 0.95, cy - s * 0.3, cx + s * 0.7, cy - s * 0.8, cx, cy - s)
        return p

    # ── Animations ────────────────────────────────────────────────────

    def show(self):
        self.setWindowOpacity(0)
        super().show()

        # Fade-in de la ventana completa
        self._fade = QPropertyAnimation(self, b"windowOpacity")
        self._fade.setDuration(420)
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.setEasingCurve(QEasingCurve.OutCubic)
        self._fade.start()

        # Slide-up del card: margen superior animado 28px → 0
        # QVariantAnimation sobre los margins del layout evita conflictos con el layout manager
        self._rv.setContentsMargins(0, 28, 0, 0)
        self._slide = QVariantAnimation(self)
        self._slide.setStartValue(28)
        self._slide.setEndValue(0)
        self._slide.setDuration(520)
        self._slide.setEasingCurve(QEasingCurve.OutCubic)
        self._slide.valueChanged.connect(
            lambda v: self._rv.setContentsMargins(0, int(v), 0, 0)
        )
        self._slide.start()

    # ── Auth ──────────────────────────────────────────────────────────

    def _on_login(self):
        if self._busy:
            return
        user = self.username_input.text().strip()
        pw = self.password_input.text()
        if not user or not pw:
            self._show_err("Ingresa usuario y contraseña para continuar.")
            return
        self._busy = True
        self._hide_err()
        self.login_btn.setText("Verificando…")
        self.login_btn.setEnabled(False)
        self.login_btn.start_spin()   # spinner animado durante auth
        self.login_btn.repaint()
        QTimer.singleShot(400, lambda: self._auth(user, pw))

    def _auth(self, user, pw):
        try:
            t = authenticate_user(user, pw)
        except Exception:
            t = None
        if t:
            self.current_user = t
            self.login_btn.stop_spin()
            self.login_btn.setText("Acceso concedido")
            self.login_btn.setStyleSheet(f"""
                QPushButton{{background:{_C['success']};color:white;
                border:none;border-radius:10px;padding:12px 0;}}
            """)
            self.login_btn.repaint()
            QTimer.singleShot(600, lambda: self._go_dashboard(t))
        else:
            self._show_err("Usuario o contraseña incorrectos. Intenta nuevamente.")
            self.password_input.clear()
            self.password_input.setFocus()
            self._reset_btn()

    def _reset_btn(self):
        self._busy = False
        self.login_btn.stop_spin()
        self.login_btn.setText("INICIAR SESIÓN")
        self.login_btn.setEnabled(True)
        self.login_btn.setStyleSheet(self._btn_css())

    def _go_dashboard(self, t):
        from windows.dashboard_window import DashboardWindow

        self.dashboard = DashboardWindow(t)
        self.dashboard.show()
        self.hide()
        self._reset_btn()

    def closeEvent(self, ev):
        ev.accept()
        sys.exit(0)


# =====================================================================
#  Input with QPainter icon
# =====================================================================
class _IconInput(QLineEdit):

    _INPUT_CSS = f"""
        QLineEdit {{
            background: {_C['input_bg']};
            border: 1px solid {_C['border']};
            border-radius: 8px;
            padding: 11px 14px 11px {{pad}}px;
            color: {_C['text']};
            font-size: 13px;
            selection-background-color: {_C['accent']};
        }}
        QLineEdit:focus {{
            border: 1.5px solid {_C['accent']};
            background: {_C['card_alt']};
        }}
        QLineEdit:hover:!focus {{
            border: 1px solid {_C['border_hl']};
        }}
    """

    def __init__(self, ph, icon=None, pw=False, right_cut=False):
        super().__init__()
        self._icon = icon
        self.setPlaceholderText(ph)
        if pw:
            self.setEchoMode(QLineEdit.Password)
        self.setFont(_f(13))
        self.setFixedHeight(46)

        pad = 40 if icon else 14
        css = self._INPUT_CSS.replace("{pad}", str(pad))
        if right_cut:
            css = css.replace(
                "border-radius: 8px;",
                "border-radius: 8px; border-top-right-radius:0; border-bottom-right-radius:0;",
            )
        self.setStyleSheet(css)

    def focusInEvent(self, ev):
        super().focusInEvent(ev)
        # Glow azul suave al hacer focus (enterprise blue, alpha 70)
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(18)
        shadow.setColor(QColor(37, 99, 235, 70))
        shadow.setOffset(0, 0)
        self.setGraphicsEffect(shadow)

    def focusOutEvent(self, ev):
        super().focusOutEvent(ev)
        self.setGraphicsEffect(None)

    def paintEvent(self, ev):
        super().paintEvent(ev)
        if not self._icon:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        c = QColor(_C["accent_lt"] if self.hasFocus() else _C["muted"])
        p.setPen(QPen(c, 1.5, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
        p.setBrush(Qt.NoBrush)
        y = self.height() / 2
        x = 14.0

        if self._icon == "user":
            p.drawEllipse(QRectF(x + 1, y - 9, 10, 10))
            arc = QPainterPath()
            arc.moveTo(x - 1, y + 9)
            arc.quadTo(x + 6, y + 1.5, x + 13, y + 9)
            p.drawPath(arc)
        elif self._icon == "lock":
            p.drawRoundedRect(QRectF(x, y + 1, 12, 8), 2, 2)
            p.drawArc(int(x + 2), int(y - 6), 8, 10, 0, 180 * 16)
        p.end()


# =====================================================================
#  Password row = input + toggle eye
# =====================================================================
class _PasswordRow(QWidget):

    def __init__(self, placeholder):
        super().__init__()
        self.setStyleSheet("background:transparent;")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self.input = _IconInput(placeholder, "lock", pw=True, right_cut=True)
        lay.addWidget(self.input)

        self._btn = _EyeToggle()
        self._btn.setFixedSize(46, 46)
        self._btn.clicked.connect(self._toggle)
        lay.addWidget(self._btn)

    def _toggle(self):
        show = self.input.echoMode() == QLineEdit.Password
        self.input.setEchoMode(QLineEdit.Normal if show else QLineEdit.Password)
        self._btn.showing = show
        self._btn.update()


class _EyeToggle(QAbstractButton):
    """Toggle button that paints a clean vector eye icon — no emojis."""

    def __init__(self):
        super().__init__()
        self.showing = False
        self.setCursor(Qt.PointingHandCursor)
        self.setToolTip("Mostrar / ocultar contraseña")
        self._hovered = False

    def enterEvent(self, ev):
        self._hovered = True
        self.update()

    def leaveEvent(self, ev):
        self._hovered = False
        self.update()

    def sizeHint(self):
        return QSize(46, 46)

    def paintEvent(self, ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()

        bg = QColor(_C["card_alt"] if self._hovered else _C["input_bg"])
        p.setPen(QPen(QColor(_C["border_hl"] if self._hovered else _C["border"]), 1))
        path_bg = QPainterPath()
        path_bg.moveTo(0, 0)
        path_bg.lineTo(w - 8, 0)
        path_bg.quadTo(w, 0, w, 8)
        path_bg.lineTo(w, h - 8)
        path_bg.quadTo(w, h, w - 8, h)
        path_bg.lineTo(0, h)
        path_bg.lineTo(0, 0)
        p.fillPath(path_bg, bg)
        p.drawPath(path_bg)

        cx, cy = w / 2, h / 2
        color = QColor(_C["accent_lt"] if self._hovered else _C["muted"])
        p.setPen(QPen(color, 1.5, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
        p.setBrush(Qt.NoBrush)

        # Eye outline
        eye = QPainterPath()
        ew, eh = 10, 5.5
        eye.moveTo(cx - ew, cy)
        eye.quadTo(cx, cy - eh * 2, cx + ew, cy)
        eye.quadTo(cx, cy + eh * 2, cx - ew, cy)
        p.drawPath(eye)

        # Pupil
        p.setBrush(color)
        p.setPen(Qt.NoPen)
        p.drawEllipse(QRectF(cx - 3, cy - 3, 6, 6))

        # Slash when hidden
        if not self.showing:
            p.setPen(QPen(color, 1.8, Qt.SolidLine, Qt.RoundCap))
            p.drawLine(int(cx - 8), int(cy + 7), int(cx + 8), int(cy - 7))

        p.end()


# =====================================================================
#  Brand panel — background image + overlay text
# =====================================================================
class _BrandPanel(QWidget):

    def __init__(self):
        super().__init__()
        bg_path = _BASE_DIR / "assets" / "login_background.png"
        self._bg = QPixmap(str(bg_path)) if bg_path.exists() else QPixmap()
        self._scaled = QPixmap()
        self._last_size = (0, 0)

    def paintEvent(self, ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        w, h = self.width(), self.height()

        # Dark fallback
        p.fillRect(self.rect(), QColor(8, 12, 24))

        # Background image (scaled + cached)
        if not self._bg.isNull():
            if (w, h) != self._last_size:
                self._scaled = self._bg.scaled(
                    w,
                    h,
                    Qt.KeepAspectRatioByExpanding,
                    Qt.SmoothTransformation,
                )
                self._last_size = (w, h)
            sx = (self._scaled.width() - w) // 2
            sy = (self._scaled.height() - h) // 2
            p.drawPixmap(0, 0, self._scaled, sx, sy, w, h)

        # Darken overlay for text readability (bottom half)
        overlay = QLinearGradient(0, h * 0.35, 0, h)
        overlay.setColorAt(0, QColor(8, 12, 24, 0))
        overlay.setColorAt(0.4, QColor(8, 12, 24, 160))
        overlay.setColorAt(1, QColor(8, 12, 24, 230))
        p.fillRect(self.rect(), QBrush(overlay))

        # Left edge vignette for smooth blending
        vig = QLinearGradient(0, 0, w * 0.15, 0)
        vig.setColorAt(0, QColor(8, 12, 24, 120))
        vig.setColorAt(1, QColor(0, 0, 0, 0))
        p.fillRect(self.rect(), QBrush(vig))

        # ── Text overlay ─────────────────────────────────────────────
        yb = int(h * 0.56)

        # Title shadow for depth
        p.setFont(QFont(_FF, 38, QFont.Bold))
        p.setPen(QColor(0, 0, 0, 80))
        p.drawText(50, yb + 2, "Safe Link")
        p.setPen(QColor(255, 255, 255, 250))
        p.drawText(48, yb, "Safe Link")

        p.setFont(QFont(_FF, 17, QFont.Light))
        p.setPen(QColor(165, 180, 252))
        p.drawText(50, yb + 36, "Monitoring")

        # Description
        p.setFont(QFont(_FF, 10))
        p.setPen(QColor(148, 163, 184, 200))
        yd = yb + 74
        for ln in [
            "Sistema de seguridad empresarial con",
            "reconocimiento facial en tiempo real.",
        ]:
            p.drawText(48, yd, ln)
            yd += 21

        # Features — checkmarks dibujados con QPainterPath (sin Unicode)
        yf = int(h * 0.78)
        ck_pen = QPen(QColor(_C["success"]), 1.8, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin)
        for feat in [
            "Reconocimiento facial con IA",
            "Registro automático de asistencia",
            "Protección contra suplantación",
        ]:
            # Checkmark vectorial: V corta centrada en (54, yf-4)
            cx_ck, cy_ck, s_ck = 54.0, float(yf) - 4.0, 5.0
            ck = QPainterPath()
            ck.moveTo(cx_ck - s_ck * 0.8, cy_ck + s_ck * 0.1)
            ck.lineTo(cx_ck - s_ck * 0.05, cy_ck + s_ck * 0.85)
            ck.lineTo(cx_ck + s_ck * 0.85, cy_ck - s_ck * 0.55)
            p.setPen(ck_pen)
            p.setBrush(Qt.NoBrush)
            p.drawPath(ck)

            p.setFont(QFont(_FF, 10))
            p.setPen(QColor(220, 228, 240))
            p.drawText(68, yf, feat)
            yf += 26

        # Version badge
        vtxt = "Safe Link Monitoring v2.0.4"
        p.setFont(QFont(_FF, 8))
        fm = QFontMetrics(p.font())
        tw = fm.horizontalAdvance(vtxt)
        vx, vy = 48, h - 26
        p.setPen(Qt.NoPen)
        p.setBrush(QColor(15, 23, 42, 200))
        p.drawRoundedRect(vx - 8, vy - 11, tw + 16, 18, 5, 5)
        p.setPen(QColor(100, 116, 139))
        p.drawText(vx, vy, vtxt)

        # Right-edge separator
        gs = QLinearGradient(w - 1, 0, w - 1, h)
        gs.setColorAt(0, QColor(99, 102, 241, 0))
        gs.setColorAt(0.25, QColor(99, 102, 241, 35))
        gs.setColorAt(0.75, QColor(99, 102, 241, 35))
        gs.setColorAt(1, QColor(99, 102, 241, 0))
        p.setPen(QPen(QBrush(gs), 1))
        p.drawLine(w - 1, 0, w - 1, h)

        p.end()
