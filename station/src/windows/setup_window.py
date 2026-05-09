"""
SetupWindow — Registro inicial de estacion fisica.
Aparece solo cuando no existe STATION_API_KEY en .env.
Autentica al admin con Supabase, crea el dispositivo
y escribe STATION_API_KEY en .env automaticamente.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv, set_key

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QFrame, QComboBox,
    QGraphicsDropShadowEffect, QSizePolicy,
)
from PyQt5.QtCore import (
    Qt, QTimer, QPropertyAnimation, QVariantAnimation,
    QEasingCurve, QRectF, QSize, QThread, pyqtSignal, QObject,
)
from PyQt5.QtGui import (
    QFont, QPalette, QColor, QPixmap, QPainter,
    QLinearGradient, QRadialGradient, QBrush, QPen,
    QPainterPath, QIcon,
)

load_dotenv()

_BASE_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BASE_DIR.parent / ".env"

# Mismos design tokens que login_window.py
_C = {
    "bg":          "#0a0f1a",
    "panel":       "#0f1525",
    "card":        "#0f172a",
    "card_alt":    "#111827",
    "input_bg":    "#0c1428",
    "border":      "#1e293b",
    "border_hl":   "#334155",
    "accent":      "#2563eb",
    "accent_dk":   "#1d4ed8",
    "accent_lt":   "#60a5fa",
    "accent_glow": "#2563eb45",
    "success":     "#22c55e",
    "success_bg":  "#052e16",
    "success_brd": "#166534",
    "error":       "#ef4444",
    "error_bg":    "#1a0a0a",
    "error_brd":   "#7f1d1d",
    "text":        "#f1f5f9",
    "text2":       "#e2e8f0",
    "dim":         "#94a3b8",
    "muted":       "#64748b",
    "faint":       "#475569",
}
_FF = "Segoe UI"


def _f(size, bold=False, weight=None):
    f = QFont(_FF, size)
    if bold:
        f.setBold(True)
    if weight is not None:
        f.setWeight(weight)
    return f


def _shadow(color="#000", blur=24, ox=0, oy=4, parent=None):
    e = QGraphicsDropShadowEffect(parent)
    e.setColor(QColor(color))
    e.setBlurRadius(blur)
    e.setOffset(ox, oy)
    return e


# ─────────────────────────────────────────────────────────────────────
#  Worker: corre en QThread para no bloquear UI
# ─────────────────────────────────────────────────────────────────────
class _SetupWorker(QObject):
    done    = pyqtSignal(str, str)   # api_key, dispositivo_id
    error   = pyqtSignal(str)
    step    = pyqtSignal(str)        # mensaje de progreso

    def __init__(self, email, password, empresa_id, sucursal_id, nombre):
        super().__init__()
        self.email       = email
        self.password    = password
        self.empresa_id  = empresa_id
        self.sucursal_id = sucursal_id
        self.nombre      = nombre

    def run(self):
        try:
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                self.error.emit("No se pudo conectar a Supabase. Verifica SUPABASE_URL y SUPABASE_KEY en .env")
                return

            # 1. Autenticar admin
            self.step.emit("Autenticando administrador...")
            auth_res = sb.auth.sign_in_with_password({
                "email": self.email,
                "password": self.password,
            })
            if not auth_res.user:
                self.error.emit("Credenciales incorrectas. Verifica email y contrasena.")
                return

            # 2. Verificar que el usuario pertenece a la empresa
            self.step.emit("Verificando acceso a la empresa...")

            # 3. Crear dispositivo via función SECURITY DEFINER (bypasa RLS)
            self.step.emit("Registrando estacion en la nube...")
            rpc_res = sb.rpc("crear_dispositivo", {
                "p_user_id":    auth_res.user.id,
                "p_nombre":     self.nombre,
                "p_sucursal_id": self.sucursal_id,
            }).execute()

            data = rpc_res.data
            if not data or not data.get("ok"):
                err = data.get("error", "error desconocido") if data else "sin respuesta"
                self.error.emit(f"No se pudo crear el dispositivo: {err}")
                return

            api_key = data["api_key"]
            device_id = data["id"]

            # 4. Guardar en .env
            self.step.emit("Guardando configuracion local...")
            env_file = str(_ENV_PATH)
            if not _ENV_PATH.exists():
                _ENV_PATH.write_text("")
            set_key(env_file, "STATION_API_KEY", api_key)

            # 5. Cerrar sesion admin (la estacion usa api_key, no sesion de usuario)
            sb.auth.sign_out()

            self.done.emit(api_key, device_id)

        except Exception as e:
            self.error.emit(str(e))


# ─────────────────────────────────────────────────────────────────────
#  Worker: carga empresas y sucursales (login previo requerido)
# ─────────────────────────────────────────────────────────────────────
class _LoadDataWorker(QObject):
    done  = pyqtSignal(list, list)   # empresas[], sucursales[]
    error = pyqtSignal(str)

    def __init__(self, email, password):
        super().__init__()
        self.email    = email
        self.password = password

    def run(self):
        try:
            from utils.supabase_client import get_supabase_client
            sb = get_supabase_client()
            if not sb:
                self.error.emit("Sin conexion a Supabase")
                return

            auth_res = sb.auth.sign_in_with_password({
                "email": self.email, "password": self.password,
            })
            if not auth_res.user:
                self.error.emit("Credenciales incorrectas")
                return

            emp_res = sb.table("empresas").select("id, nombre").eq("activa", True).execute()
            suc_res = sb.table("sucursales").select("id, nombre, empresa_id").eq("activa", True).execute()
            sb.auth.sign_out()

            self.done.emit(emp_res.data or [], suc_res.data or [])
        except Exception as e:
            self.error.emit(str(e))


# ─────────────────────────────────────────────────────────────────────
#  Input field reutilizable (igual que login_window)
# ─────────────────────────────────────────────────────────────────────
class _Input(QLineEdit):
    def __init__(self, placeholder, pw=False):
        super().__init__()
        self.setPlaceholderText(placeholder)
        if pw:
            self.setEchoMode(QLineEdit.Password)
        self.setFont(_f(13))
        self.setFixedHeight(46)
        self.setStyleSheet(f"""
            QLineEdit {{
                background: {_C['input_bg']};
                border: 1px solid {_C['border']};
                border-radius: 8px;
                padding: 11px 14px;
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
        """)

    def focusInEvent(self, ev):
        super().focusInEvent(ev)
        s = QGraphicsDropShadowEffect(self)
        s.setBlurRadius(18)
        s.setColor(QColor(37, 99, 235, 70))
        s.setOffset(0, 0)
        self.setGraphicsEffect(s)

    def focusOutEvent(self, ev):
        super().focusOutEvent(ev)
        self.setGraphicsEffect(None)


class _Combo(QComboBox):
    def __init__(self):
        super().__init__()
        self.setFont(_f(13))
        self.setFixedHeight(46)
        self.setCursor(Qt.PointingHandCursor)
        self.setStyleSheet(f"""
            QComboBox {{
                background: {_C['input_bg']};
                border: 1px solid {_C['border']};
                border-radius: 8px;
                padding: 0 14px;
                color: {_C['text']};
                font-size: 13px;
            }}
            QComboBox:hover {{ border: 1px solid {_C['border_hl']}; }}
            QComboBox:focus {{ border: 1.5px solid {_C['accent']}; }}
            QComboBox::drop-down {{
                border: none; width: 32px;
                subcontrol-origin: padding; subcontrol-position: right center;
            }}
            QComboBox QAbstractItemView {{
                background: {_C['card_alt']};
                border: 1px solid {_C['border_hl']};
                border-radius: 8px;
                color: {_C['text']};
                selection-background-color: {_C['accent']};
                padding: 4px;
                outline: none;
            }}
        """)


# ─────────────────────────────────────────────────────────────────────
#  Boton principal con spinner
# ─────────────────────────────────────────────────────────────────────
class _ActionButton(QPushButton):
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self._spinning = False
        self._angle    = 0
        self._timer    = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self.setCursor(Qt.PointingHandCursor)
        self.setFixedHeight(50)
        self.setFont(_f(12, True))
        self._apply_normal()

    def _apply_normal(self):
        self.setStyleSheet(f"""
            QPushButton {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 {_C['accent']}, stop:1 {_C['accent_dk']});
                color: white; border: none; border-radius: 10px; padding: 12px 0;
            }}
            QPushButton:hover {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 {_C['accent_lt']}, stop:1 {_C['accent']});
            }}
            QPushButton:pressed {{ background: #1e40af; }}
            QPushButton:disabled {{ background: {_C['border']}; color: {_C['muted']}; }}
        """)

    def apply_success(self):
        self._spinning = False
        self._timer.stop()
        self.setStyleSheet(f"""
            QPushButton {{
                background: {_C['success_bg']};
                border: 1px solid {_C['success_brd']};
                color: {_C['success']}; border-radius: 10px; padding: 12px 0;
            }}
        """)

    def start_spin(self):
        self._spinning = True
        self._angle = 0
        self._timer.start(22)
        self.setEnabled(False)
        self.update()

    def stop_spin(self):
        self._spinning = False
        self._timer.stop()
        self.setEnabled(True)
        self._apply_normal()
        self.update()

    def _tick(self):
        self._angle = (self._angle + 9) % 360
        self.update()

    def paintEvent(self, ev):
        super().paintEvent(ev)
        if not self._spinning:
            return
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        sz = 16
        x = self.width() // 2 + 60
        y = (self.height() - sz) // 2
        p.setPen(QPen(QColor(255, 255, 255, 200), 2.2, Qt.SolidLine, Qt.RoundCap))
        p.setBrush(Qt.NoBrush)
        p.drawArc(QRectF(x, y, sz, sz), self._angle * 16, 260 * 16)
        p.end()


# ─────────────────────────────────────────────────────────────────────
#  Panel de fondo decorativo (dot grid + glow)
# ─────────────────────────────────────────────────────────────────────
class _BgPanel(QWidget):
    def paintEvent(self, ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()
        p.fillRect(self.rect(), QColor(_C["bg"]))

        # Glow central
        glow = QRadialGradient(w / 2, h / 2, min(w, h) * 0.6)
        glow.setColorAt(0.0, QColor(37, 99, 235, 18))
        glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.fillRect(self.rect(), QBrush(glow))

        # Dot grid
        p.setPen(QPen(QColor(255, 255, 255, 14), 1.2))
        step = 28
        for x in range(0, w + step, step):
            for y in range(0, h + step, step):
                p.drawPoint(x, y)
        p.end()


# ─────────────────────────────────────────────────────────────────────
#  Card con franja azul superior
# ─────────────────────────────────────────────────────────────────────
class _Card(QFrame):
    def paintEvent(self, ev):
        super().paintEvent(ev)
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w = self.width()
        grad = QLinearGradient(0, 0, w, 0)
        grad.setColorAt(0.00, QColor(37, 99, 235, 0))
        grad.setColorAt(0.20, QColor(37, 99, 235, 220))
        grad.setColorAt(0.75, QColor(96, 165, 250, 180))
        grad.setColorAt(1.00, QColor(37, 99, 235, 0))
        clip = QPainterPath()
        clip.addRect(QRectF(0, 0, w, 4))
        rounded = QPainterPath()
        rounded.addRoundedRect(QRectF(0, 0, w, 4), 16, 16)
        p.setClipPath(clip.intersected(rounded))
        p.setPen(Qt.NoPen)
        p.fillRect(0, 0, w, 4, QBrush(grad))
        p.end()


# ─────────────────────────────────────────────────────────────────────
#  SetupWindow — ventana principal
# ─────────────────────────────────────────────────────────────────────
class SetupWindow(QMainWindow):
    setup_complete = pyqtSignal()   # emitido cuando todo quedo guardado

    def __init__(self):
        super().__init__()
        self._thread    = None
        self._worker    = None
        self._empresas  = []
        self._sucursales_all = []
        self._step = "credentials"   # credentials → select → done
        self._init_ui()

    # ── UI ────────────────────────────────────────────────────────────
    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring — Configuracion inicial")
        self.setMinimumSize(520, 700)
        self.resize(560, 720)
        self.setStyleSheet(f"QMainWindow{{background:{_C['bg']}}}")

        root = _BgPanel()
        self.setCentralWidget(root)
        outer = QVBoxLayout(root)
        outer.setContentsMargins(40, 0, 40, 30)
        outer.addStretch(1)

        # Card
        card = _Card()
        card.setObjectName("setupCard")
        card.setStyleSheet(f"""
            QFrame#setupCard {{
                background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                    stop:0 #111827, stop:1 {_C['card']});
                border: 1px solid rgba(37,99,235,0.30);
                border-radius: 16px;
            }}
        """)
        card.setGraphicsEffect(_shadow(_C["accent_glow"], 55, 0, 10))
        cl = QVBoxLayout(card)
        cl.setContentsMargins(36, 36, 36, 32)
        cl.setSpacing(0)

        # Shield icon
        shield_lbl = QLabel()
        shield_lbl.setPixmap(self._shield_px(54))
        shield_lbl.setAlignment(Qt.AlignCenter)
        shield_lbl.setStyleSheet("background:transparent;")
        cl.addWidget(shield_lbl)
        cl.addSpacing(16)

        # Titulo
        title = QLabel("Configuracion inicial")
        title.setFont(_f(22, weight=80))
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(f"color:{_C['text']};background:transparent;")
        cl.addWidget(title)

        sub = QLabel("Esta estacion aun no esta registrada.\nIngresa tus credenciales de administrador para continuar.")
        sub.setFont(_f(11))
        sub.setAlignment(Qt.AlignCenter)
        sub.setWordWrap(True)
        sub.setStyleSheet(f"color:{_C['dim']};background:transparent;line-height:150%;")
        cl.addWidget(sub)
        cl.addSpacing(24)

        # Mensaje de estado (error / progreso / exito)
        self._msg_frame = self._make_msg_frame()
        cl.addWidget(self._msg_frame)

        # ── PASO 1: Credenciales ──────────────────────────────────────
        self._step1 = QWidget()
        self._step1.setStyleSheet("background:transparent;")
        s1 = QVBoxLayout(self._step1)
        s1.setContentsMargins(0,0,0,0)
        s1.setSpacing(0)

        s1.addWidget(self._field_lbl("CORREO DEL ADMINISTRADOR"))
        s1.addSpacing(4)
        self._email_input = _Input("admin@empresa.com")
        s1.addWidget(self._email_input)
        s1.addSpacing(14)

        s1.addWidget(self._field_lbl("CONTRASENA"))
        s1.addSpacing(4)
        self._pw_input = _Input("Tu contrasena de Supabase", pw=True)
        s1.addWidget(self._pw_input)
        s1.addSpacing(22)

        self._btn1 = _ActionButton("Verificar credenciales")
        self._btn1.setGraphicsEffect(_shadow(_C["accent_glow"], 30, 0, 6))
        self._btn1.clicked.connect(self._on_verify)
        self._email_input.returnPressed.connect(self._pw_input.setFocus)
        self._pw_input.returnPressed.connect(self._on_verify)
        s1.addWidget(self._btn1)

        cl.addWidget(self._step1)

        # ── PASO 2: Seleccion empresa + sucursal + nombre ─────────────
        self._step2 = QWidget()
        self._step2.setStyleSheet("background:transparent;")
        self._step2.setVisible(False)
        s2 = QVBoxLayout(self._step2)
        s2.setContentsMargins(0,0,0,0)
        s2.setSpacing(0)

        s2.addWidget(self._field_lbl("EMPRESA"))
        s2.addSpacing(4)
        self._emp_combo = _Combo()
        self._emp_combo.currentIndexChanged.connect(self._on_empresa_changed)
        s2.addWidget(self._emp_combo)
        s2.addSpacing(14)

        s2.addWidget(self._field_lbl("SUCURSAL (OPCIONAL)"))
        s2.addSpacing(4)
        self._suc_combo = _Combo()
        s2.addWidget(self._suc_combo)
        s2.addSpacing(14)

        s2.addWidget(self._field_lbl("NOMBRE DE ESTA ESTACION"))
        s2.addSpacing(4)
        self._nombre_input = _Input("Ej: Entrada Principal, Almacen, Recepcion")
        s2.addWidget(self._nombre_input)
        s2.addSpacing(22)

        self._btn2 = _ActionButton("Registrar esta estacion")
        self._btn2.setGraphicsEffect(_shadow(_C["accent_glow"], 30, 0, 6))
        self._btn2.clicked.connect(self._on_register)
        s2.addWidget(self._btn2)

        # Boton volver
        back_btn = QPushButton("Volver")
        back_btn.setFont(_f(10))
        back_btn.setCursor(Qt.PointingHandCursor)
        back_btn.setFixedHeight(36)
        back_btn.setStyleSheet(f"""
            QPushButton {{
                background:transparent; border:1px solid {_C['border']};
                border-radius:8px; color:{_C['muted']};
            }}
            QPushButton:hover {{ border-color:{_C['border_hl']}; color:{_C['dim']}; }}
        """)
        back_btn.clicked.connect(self._go_step1)
        s2.addSpacing(8)
        s2.addWidget(back_btn)

        cl.addWidget(self._step2)

        # ── PASO 3: Exito ─────────────────────────────────────────────
        self._step3 = QWidget()
        self._step3.setStyleSheet("background:transparent;")
        self._step3.setVisible(False)
        s3 = QVBoxLayout(self._step3)
        s3.setContentsMargins(0,0,0,0)
        s3.setSpacing(0)

        self._success_lbl = QLabel()
        self._success_lbl.setFont(_f(12))
        self._success_lbl.setWordWrap(True)
        self._success_lbl.setAlignment(Qt.AlignCenter)
        self._success_lbl.setStyleSheet(f"""
            color:{_C['success']}; background:{_C['success_bg']};
            border:1px solid {_C['success_brd']};
            border-radius:10px; padding:16px;
        """)
        s3.addWidget(self._success_lbl)
        s3.addSpacing(20)

        self._btn3 = _ActionButton("Iniciar Safe Link Monitoring")
        self._btn3.apply_success()
        self._btn3.setEnabled(True)
        self._btn3.setStyleSheet(f"""
            QPushButton {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 {_C['success']}, stop:1 #16a34a);
                color:white; border:none; border-radius:10px; padding:12px 0;
            }}
            QPushButton:hover {{ background:#16a34a; }}
        """)
        self._btn3.clicked.connect(self._on_launch)
        s3.addWidget(self._btn3)

        cl.addWidget(self._step3)

        # Footer
        cl.addSpacing(20)
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet("background: rgba(37,99,235,0.20);")
        cl.addWidget(sep)
        cl.addSpacing(12)
        foot = QLabel("Safe Link Monitoring  —  Configuracion de estacion fisica")
        foot.setFont(_f(8))
        foot.setAlignment(Qt.AlignCenter)
        foot.setStyleSheet(f"color:{_C['faint']};background:transparent;")
        cl.addWidget(foot)

        outer.addWidget(card)
        outer.addStretch(1)

    # ── Helpers ───────────────────────────────────────────────────────
    def _field_lbl(self, txt):
        l = QLabel(txt)
        l.setFont(_f(8, True))
        l.setStyleSheet(f"color:{_C['muted']};background:transparent;")
        return l

    def _make_msg_frame(self):
        f = QFrame()
        f.setVisible(False)
        lay = QHBoxLayout(f)
        lay.setContentsMargins(12, 10, 12, 10)
        lay.setSpacing(8)
        self._msg_lbl = QLabel()
        self._msg_lbl.setFont(_f(10))
        self._msg_lbl.setWordWrap(True)
        self._msg_lbl.setStyleSheet("background:transparent;")
        lay.addWidget(self._msg_lbl)
        return f

    def _show_error(self, msg):
        self._msg_frame.setStyleSheet(f"""
            QFrame {{ background:{_C['error_bg']}; border:1px solid {_C['error_brd']}; border-radius:8px; }}
        """)
        self._msg_lbl.setStyleSheet(f"color:#fca5a5;background:transparent;")
        self._msg_lbl.setText(msg)
        self._msg_frame.setVisible(True)

    def _show_info(self, msg):
        self._msg_frame.setStyleSheet(f"""
            QFrame {{ background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.25); border-radius:8px; }}
        """)
        self._msg_lbl.setStyleSheet(f"color:{_C['accent_lt']};background:transparent;")
        self._msg_lbl.setText(msg)
        self._msg_frame.setVisible(True)

    def _hide_msg(self):
        self._msg_frame.setVisible(False)

    def _go_step1(self):
        self._step2.setVisible(False)
        self._step1.setVisible(True)
        self._hide_msg()

    def _go_step2(self):
        self._step1.setVisible(False)
        self._step2.setVisible(True)
        self._hide_msg()

    def _go_step3(self, api_key, device_id):
        self._step2.setVisible(False)
        self._step3.setVisible(True)
        nombre = self._nombre_input.text().strip() or "Estacion"
        self._success_lbl.setText(
            f"Estacion registrada exitosamente.\n\n"
            f"Nombre:  {nombre}\n"
            f"ID:  {device_id[:18]}...\n\n"
            f"La API Key ha sido guardada en .env automaticamente.\n"
            f"No necesitas hacer nada mas."
        )
        self._hide_msg()

    def _on_empresa_changed(self, idx):
        if idx < 0 or idx >= len(self._empresas):
            return
        empresa_id = self._empresas[idx]["id"]
        self._suc_combo.clear()
        self._suc_combo.addItem("-- Sin sucursal asignada --", None)
        for s in self._sucursales_all:
            if s["empresa_id"] == empresa_id:
                self._suc_combo.addItem(s["nombre"], s["id"])

    # ── Paso 1: Verificar credenciales y cargar datos ──────────────────
    def _on_verify(self):
        email = self._email_input.text().strip()
        pw    = self._pw_input.text()
        if not email or not pw:
            self._show_error("Ingresa correo y contrasena.")
            return
        self._hide_msg()
        self._btn1.start_spin()
        self._btn1.setText("Verificando...")

        self._thread = QThread()
        self._worker = _LoadDataWorker(email, pw)
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.done.connect(self._on_data_loaded)
        self._worker.error.connect(self._on_load_error)
        self._worker.done.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_data_loaded(self, empresas, sucursales):
        self._btn1.stop_spin()
        self._btn1.setText("Verificar credenciales")
        self._empresas = empresas
        self._sucursales_all = sucursales

        if not empresas:
            self._show_error("No se encontraron empresas activas para este usuario.")
            return

        self._emp_combo.clear()
        for e in empresas:
            self._emp_combo.addItem(e["nombre"], e["id"])

        self._go_step2()

    def _on_load_error(self, msg):
        self._btn1.stop_spin()
        self._btn1.setText("Verificar credenciales")
        self._show_error(f"Error: {msg}")

    # ── Paso 2: Registrar estacion ────────────────────────────────────
    def _on_register(self):
        nombre = self._nombre_input.text().strip()
        if not nombre:
            self._show_error("Escribe un nombre para esta estacion.")
            return

        emp_idx = self._emp_combo.currentIndex()
        if emp_idx < 0 or emp_idx >= len(self._empresas):
            self._show_error("Selecciona una empresa.")
            return
        empresa_id  = self._empresas[emp_idx]["id"]
        sucursal_id = self._suc_combo.currentData()

        self._hide_msg()
        self._btn2.start_spin()
        self._btn2.setText("Registrando...")

        self._thread = QThread()
        self._worker = _SetupWorker(
            self._email_input.text().strip(),
            self._pw_input.text(),
            empresa_id, sucursal_id, nombre,
        )
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.step.connect(self._show_info)
        self._worker.done.connect(self._on_register_done)
        self._worker.error.connect(self._on_register_error)
        self._worker.done.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.start()

    def _on_register_done(self, api_key, device_id):
        self._btn2.stop_spin()
        self._btn2.setText("Registrar esta estacion")
        # Recargar .env para que station_manager lo lea
        load_dotenv(override=True)
        os.environ["STATION_API_KEY"] = api_key
        self._go_step3(api_key, device_id)

    def _on_register_error(self, msg):
        self._btn2.stop_spin()
        self._btn2.setText("Registrar esta estacion")
        self._show_error(f"Error al registrar: {msg}")

    # ── Paso 3: Lanzar app ────────────────────────────────────────────
    def _on_launch(self):
        self.hide()
        # Emitir después de ocultar para que _after_setup no destruya el objeto
        # mientras aún estamos en el stack de llamadas de este método
        QTimer.singleShot(0, self.setup_complete.emit)

    # ── Shield pixmap ─────────────────────────────────────────────────
    def _shield_px(self, sz):
        px = QPixmap(sz, sz)
        px.fill(Qt.transparent)
        p = QPainter(px)
        p.setRenderHint(QPainter.Antialiasing)
        cx, cy, s = sz / 2, sz / 2, sz * 0.42

        gl = QRadialGradient(cx, cy, sz * 0.48)
        gl.setColorAt(0, QColor(37, 99, 235, 50))
        gl.setColorAt(1, QColor(0, 0, 0, 0))
        p.setBrush(QBrush(gl))
        p.setPen(Qt.NoPen)
        p.drawEllipse(0, 0, sz, sz)

        path = self._shield_path(cx, cy, s)
        g = QLinearGradient(cx, cy - s, cx, cy + s)
        g.setColorAt(0, QColor(_C["accent_lt"]))
        g.setColorAt(1, QColor(_C["accent_dk"]))
        p.setBrush(QBrush(g))
        p.setPen(QPen(QColor(147, 197, 253, 110), 1))
        p.drawPath(path)

        p.setPen(QPen(QColor(255, 255, 255, 220), 2.4, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
        p.setBrush(Qt.NoBrush)
        ck = QPainterPath()
        ck.moveTo(cx - s * 0.28, cy + s * 0.05)
        ck.lineTo(cx - s * 0.05, cy + s * 0.30)
        ck.lineTo(cx + s * 0.32, cy - s * 0.22)
        p.drawPath(ck)
        p.end()
        return px

    @staticmethod
    def _shield_path(cx, cy, s):
        p = QPainterPath()
        p.moveTo(cx, cy - s)
        p.cubicTo(cx - s*0.7, cy - s*0.8, cx - s*0.95, cy - s*0.3, cx - s*0.85, cy + s*0.3)
        p.quadTo(cx - s*0.3, cy + s*0.95, cx, cy + s*1.05)
        p.quadTo(cx + s*0.3, cy + s*0.95, cx + s*0.85, cy + s*0.3)
        p.cubicTo(cx + s*0.95, cy - s*0.3, cx + s*0.7, cy - s*0.8, cx, cy - s)
        return p

    # ── Fade in ───────────────────────────────────────────────────────
    def show(self):
        self.setWindowOpacity(0)
        super().show()
        anim = QPropertyAnimation(self, b"windowOpacity")
        anim.setDuration(400)
        anim.setStartValue(0.0)
        anim.setEndValue(1.0)
        anim.setEasingCurve(QEasingCurve.OutCubic)
        anim.start()
        self._fade_anim = anim

    def closeEvent(self, ev):
        ev.accept()
