"""
Ventana principal del dashboard con cámara y reconocimiento facial.
"""

import logging
import threading

from PyQt5.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QMessageBox,
    QApplication,
    QGraphicsDropShadowEffect,
    QSizePolicy,
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, QSize, QVariantAnimation, QEasingCurve
from PyQt5.QtGui import (
    QImage,
    QPixmap,
    QFont,
    QPalette,
    QColor,
    QPainter,
    QLinearGradient,
    QBrush,
    QPainterPath,
    QPen,
    QIcon,
)
import cv2
import numpy as np
from datetime import datetime
from typing import Dict
from utils.models import Trabajador, RegistroAsistencia
from utils.database import get_db_session
from sqlalchemy import func
from utils.employee_mapper import get_photo_path
from pathlib import Path
from utils.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

try:
    from utils.design_tokens import SHARED as _SHARED
except ImportError:
    _SHARED = {}

FACE_RECOGNITION_AVAILABLE = False
reconocer_desde_frame = None
inicializar_sistema_facial = None


def _lazy_load_face_recognition():
    global FACE_RECOGNITION_AVAILABLE, reconocer_desde_frame, inicializar_sistema_facial
    if reconocer_desde_frame is not None:
        return
    try:
        from utils.face_recognition import (
            reconocer_desde_frame as _reconocer,
            inicializar_sistema_facial as _inicializar,
            FACE_RECOGNITION_AVAILABLE as _available,
        )

        reconocer_desde_frame = _reconocer
        inicializar_sistema_facial = _inicializar
        FACE_RECOGNITION_AVAILABLE = _available
    except ImportError:
        FACE_RECOGNITION_AVAILABLE = False

        def _dummy_reconocer(*args, **kwargs):
            return False, 0.0, None

        def _dummy_inicializar():
            return False

        reconocer_desde_frame = _dummy_reconocer
        inicializar_sistema_facial = _dummy_inicializar


# ---------------------------------------------------------------------------
# Estilos centralizados
# ---------------------------------------------------------------------------

_COLORS = {
    # Fondos — alineados con design_tokens SHARED
    "bg_dark":    _SHARED.get("bg_oled",   "#010409"),
    "bg_card":    "rgba(22, 27, 34, 0.8)",
    "bg_card_alt":"rgba(33, 38, 45, 0.5)",
    # Bordes
    "border":        _SHARED.get("border",        "rgba(240, 246, 252, 0.18)"),
    "border_strong": _SHARED.get("border_strong", "rgba(240, 246, 252, 0.28)"),
    "border_accent": "#58a6ff",
    # Texto — alineados con design_tokens SHARED
    "text":      _SHARED.get("text_primary", "#f0f6fc"),
    "text_dim":  _SHARED.get("text_dim",     "#8b949e"),
    "text_muted":_SHARED.get("text_muted",   "#484f58"),
    # Semánticos — alineados con design_tokens SHARED
    "success": _SHARED.get("success", "#22c55e"),
    "warning": _SHARED.get("warning", "#f59e0b"),
    "danger":  _SHARED.get("danger",  "#ef4444"),
    # Acento dashboard (Electric Blue — diferente del Enterprise Blue del login)
    "accent":      "#00d2ff",
    "accent_dark": "#3a86ff",
    "gradient_main": "qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #00d2ff, stop:1 #3a86ff)",
}


def _glass_style(extra=""):
    return f"""
        QFrame {{
            background: {_COLORS['bg_card']};
            border: 1px solid {_COLORS['border']};
            border-radius: 24px;
            {extra}
        }}
    """


def _btn_style(color, hover, pressed=None):
    pressed = pressed or hover
    bg = color if color.startswith("qlineargradient") else color
    return f"""
        QPushButton {{
            background: {bg};
            color: white;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 14px 24px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        QPushButton:hover {{
            background: {hover};
            border: 1.5px solid rgba(255,255,255,0.35);
        }}
        QPushButton:pressed {{ background: {pressed}; }}
        QPushButton:disabled {{ background: #161b22; color: #484f58; border: 1px solid #30363d; }}
    """


# ---------------------------------------------------------------------------
# Helper: ícono vectorial dibujado con QPainter (sin emojis ni Unicode)
# ---------------------------------------------------------------------------

def _make_dialog_icon(color_hex: str, is_check: bool, size: int = 56) -> QPixmap:
    """Dibuja un círculo con checkmark (entrada) o flecha salida (salida)."""
    px = QPixmap(size, size)
    px.fill(Qt.transparent)
    p = QPainter(px)
    p.setRenderHint(QPainter.Antialiasing)

    # Círculo de fondo
    p.setPen(Qt.NoPen)
    p.setBrush(QColor(color_hex))
    p.drawEllipse(0, 0, size, size)

    # Ícono blanco encima
    pen = QPen(QColor(255, 255, 255, 230), 2.8, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin)
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
        # Flecha de salida →
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


# ---------------------------------------------------------------------------
# Widget: arco circular de confianza
# ---------------------------------------------------------------------------


class _ConfidenceArc(QWidget):
    """Muestra el % de confianza como arco circular + valor numérico central."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._pct = -1.0
        self._color = QColor(_COLORS["text_muted"])
        self.setFixedSize(140, 140)
        self.setAttribute(Qt.WA_TransparentForMouseEvents)
        self.setStyleSheet("background: transparent;")

    def set_value(self, pct: float, color_hex: str):
        self._pct = max(0.0, min(100.0, pct))
        self._color = QColor(color_hex)
        self.update()

    def reset(self):
        self._pct = -1.0
        self._color = QColor(_COLORS["text_muted"])
        self.update()

    def paintEvent(self, _ev):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        W, H = self.width(), self.height()
        margin = 12
        r = min(W, H) // 2 - margin
        cx, cy = W // 2, H // 2

        # Track ring (fondo del arco)
        p.setPen(QPen(QColor(255, 255, 255, 18), 7, Qt.SolidLine, Qt.RoundCap))
        p.setBrush(Qt.NoBrush)
        p.drawEllipse(cx - r, cy - r, 2 * r, 2 * r)

        # Arco de valor (sentido horario desde las 12)
        if self._pct >= 0:
            arc_pen = QPen(self._color, 7, Qt.SolidLine, Qt.RoundCap)
            p.setPen(arc_pen)
            span = int(self._pct / 100.0 * 360 * 16)
            p.drawArc(cx - r, cy - r, 2 * r, 2 * r, 90 * 16, -span)

        # Texto central
        txt = f"{self._pct:.0f}%" if self._pct >= 0 else "--"
        p.setPen(QPen(self._color))
        font_sz = 24 if self._pct >= 0 else 28
        p.setFont(QFont("Consolas", font_sz, QFont.Bold))
        p.drawText(self.rect(), Qt.AlignCenter, txt)
        p.end()


# ---------------------------------------------------------------------------
# Diálogo personalizado de asistencia
# ---------------------------------------------------------------------------


class AttendanceDialog(QWidget):
    """Diálogo premium personalizado para registro de asistencia."""

    def __init__(self, tipo, nombre, confianza, hora, parent=None):
        super().__init__(
            parent, Qt.Window | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(420, 320)
        if parent:
            geo = parent.geometry()
            self.move(geo.center().x() - 210, geo.center().y() - 160)
        self._build_ui(tipo, nombre, confianza, hora)

    def _build_ui(self, tipo, nombre, confianza, hora):
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)

        card = QFrame()
        card.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, 
                    stop:0 rgba(22, 27, 34, 0.95), stop:1 rgba(13, 17, 23, 0.95));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 30px;
            }}
        """)
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(40)
        shadow.setColor(QColor(0, 0, 0, 120))
        shadow.setOffset(0, 8)
        card.setGraphicsEffect(shadow)

        cl = QVBoxLayout(card)
        cl.setContentsMargins(32, 28, 32, 24)
        cl.setSpacing(0)

        is_entrada = tipo.upper() == "ENTRADA"
        accent = _COLORS["success"] if is_entrada else _COLORS["accent"]

        # Icon circle — dibujado con QPainter (sin emojis ni Unicode)
        icon_lbl = QLabel()
        icon_lbl.setFixedSize(56, 56)
        icon_lbl.setAlignment(Qt.AlignCenter)
        icon_lbl.setStyleSheet("background: transparent;")
        icon_lbl.setPixmap(_make_dialog_icon(accent, is_check=is_entrada, size=56))
        cl.addWidget(icon_lbl, 0, Qt.AlignCenter)
        cl.addSpacing(14)

        # Title
        title = QLabel(f"{tipo.upper()} Registrada")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(f"color: {_COLORS['text']}; background:transparent;")
        cl.addWidget(title)
        cl.addSpacing(16)

        # Info rows — Confianza y Hora usan Consolas (font monoespaciada para datos)
        _mono = {"Confianza", "Hora"}
        for label, value, color in [
            ("Empleado", nombre, _COLORS["text"]),
            ("Confianza", f"{confianza}%", accent),
            ("Hora", hora, _COLORS["text_dim"]),
        ]:
            row = QHBoxLayout()
            row.setContentsMargins(0, 4, 0, 4)
            lk = QLabel(label)
            lk.setFont(QFont("Segoe UI", 11))
            lk.setStyleSheet(f"color: {_COLORS['text_muted']}; background:transparent;")
            row.addWidget(lk)
            row.addStretch()
            vk = QLabel(value)
            font_family = "Consolas" if label in _mono else "Segoe UI"
            vk.setFont(QFont(font_family, 11, QFont.Bold))
            vk.setStyleSheet(f"color: {color}; background:transparent;")
            row.addWidget(vk)
            cl.addLayout(row)

        cl.addSpacing(20)

        cl.addSpacing(24)

        # Countdown info — número prominente + texto
        self._secs_left = 5
        self.countdown_label = QLabel(f"Cerrando en  {self._secs_left}s")
        self.countdown_label.setFont(QFont("Consolas", 11, QFont.Bold))
        self.countdown_label.setAlignment(Qt.AlignCenter)
        self.countdown_label.setStyleSheet(
            f"color: {accent}; background: rgba(255,255,255,0.05);"
            f"border-radius: 8px; padding: 6px 12px;"
        )
        cl.addWidget(self.countdown_label)

        self._count_timer = QTimer(self)
        self._count_timer.timeout.connect(self._update_countdown)
        self._count_timer.start(1000)

        outer.addWidget(card)

    def _update_countdown(self):
        self._secs_left -= 1
        if self._secs_left > 0:
            self.countdown_label.setText(f"Cerrando en  {self._secs_left}s")
        else:
            self._count_timer.stop()
            self.close()

    def paintEvent(self, event):
        """Fondo semi-transparente."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.fillRect(self.rect(), QColor(0, 0, 0, 80))


# ---------------------------------------------------------------------------
# Hilos de cámara y reconocimiento
# ---------------------------------------------------------------------------


class CameraThread(QThread):
    frame_ready = pyqtSignal(np.ndarray)
    camera_started = pyqtSignal(bool)

    def __init__(self, camera_index=0):
        super().__init__()
        self.running = False
        self.cap = None
        self.camera_index = camera_index

    def start_camera(self):
        self.running = True
        self.start()

    def run(self):
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if self.cap:
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.msleep(100)
            if not self.cap or not self.cap.isOpened():
                self.camera_started.emit(False)
                return
            ret, _ = self.cap.read()
            if not ret:
                self.msleep(200)
                ret, _ = self.cap.read()
                if not ret:
                    self.camera_started.emit(False)
                    return
            self.camera_started.emit(True)
            skip = 0
            while self.running and self.cap:
                ret, frame = self.cap.read()
                if ret:
                    frame = cv2.flip(frame, 1)
                    if skip % 2 == 0:
                        try:
                            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                            l, a, b = cv2.split(lab)
                            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
                            l = clahe.apply(l)
                            frame = cv2.cvtColor(
                                cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR
                            )
                        except Exception:
                            pass
                    skip += 1
                    self.frame_ready.emit(frame)
                else:
                    self.msleep(100)
                self.msleep(50)
        except Exception as e:
            logger.error(f"Error en CameraThread: {e}")
            self.camera_started.emit(False)
        finally:
            if self.cap:
                try:
                    self.cap.release()
                except Exception:
                    pass

    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()
        self.wait()


class RecognitionThread(QThread):
    results_ready = pyqtSignal(bool, float, object, str)

    _METHODS = ("hybrid", "photo_matcher", "opencv")

    def __init__(self, parent=None):
        super().__init__(parent)
        self.running = False
        self.current_frame = None
        self.last_process_time = 0
        self.process_interval = 2.5
        self.processing = False
        self._frame_lock = threading.Lock()
        self._last_frame_sig = None
        self._disabled_methods: set = set()
        self._error_counts: dict = {}
        self._MAX_ERRORS_BEFORE_DISABLE = 3

    def set_frame(self, frame):
        if self.processing:
            return
        acquired = self._frame_lock.acquire(blocking=False)
        if not acquired:
            return
        try:
            self.current_frame = frame.copy() if frame is not None else None
        finally:
            self._frame_lock.release()

    def stop(self):
        self.running = False
        self.processing = False
        self.wait(2000)

    def run(self):
        import time

        self.running = True
        while self.running:
            if self.current_frame is not None and not self.processing:
                t = time.time()
                if t - self.last_process_time >= self.process_interval:
                    self.last_process_time = t
                    self.processing = True
                    try:
                        with self._frame_lock:
                            f = (
                                self.current_frame.copy()
                                if self.current_frame is not None
                                else None
                            )
                        if f is not None:
                            self._process_frame(f)
                    except Exception as e:
                        msg = str(e)
                        if "1114" in msg or "DLL" in msg:
                            self.process_interval = min(
                                self.process_interval + 0.5, 5.0
                            )
                        else:
                            logger.error(f"RecognitionThread: {msg[:150]}")
                    finally:
                        self.processing = False
            self.msleep(300)

    def _is_same_frame(self, frame) -> bool:
        sig = (float(frame.mean()), float(frame.std()), frame.shape[0], frame.shape[1])
        if sig == self._last_frame_sig:
            return True
        self._last_frame_sig = sig
        return False

    def _record_error(self, method: str, error: Exception):
        count = self._error_counts.get(method, 0) + 1
        self._error_counts[method] = count
        msg = str(error)
        fatal = any(s in msg for s in ("1114", "DLL", "WinError"))
        if fatal or count >= self._MAX_ERRORS_BEFORE_DISABLE:
            self._disabled_methods.add(method)
            logger.warning(
                f"'{method}' deshabilitado: {type(error).__name__}: {msg[:80]}"
            )
        elif count == 1:
            logger.debug(f"Error '{method}': {msg[:80]}")

    def _process_frame(self, frame):
        if self._is_same_frame(frame):
            return
        h, w = frame.shape[:2]
        mx = 480
        if h > mx or w > mx:
            s = min(mx / h, mx / w)
            frame = cv2.resize(
                frame, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA
            )

        if "hybrid" not in self._disabled_methods:
            try:
                from utils.hybrid_opencv_gemini_matcher import match_photo_hybrid

                ok, conf, info, method = match_photo_hybrid(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._error_counts.pop("hybrid", None)
                    self.results_ready.emit(True, conf, info, method)
                    return
            except Exception as e:
                self._record_error("hybrid", e)

        if "photo_matcher" not in self._disabled_methods:
            try:
                from utils.photo_to_photo_matcher import match_photo_from_frame

                ok, conf, info = match_photo_from_frame(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._error_counts.pop("photo_matcher", None)
                    self.results_ready.emit(True, conf, info, "Foto")
                    return
            except Exception as e:
                self._record_error("photo_matcher", e)

        if "opencv" not in self._disabled_methods:
            try:
                from utils.face_recognition_opencv import recognize_opencv

                ok, conf, info = recognize_opencv(frame)
                if ok and info:
                    self._error_counts.pop("opencv", None)
                    self.results_ready.emit(True, conf, info, "OpenCV")
                    return
            except Exception as e:
                self._record_error("opencv", e)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


class DashboardWindow(QMainWindow):

    def __init__(self, trabajador: Trabajador):
        super().__init__()
        self.trabajador = trabajador
        self.camera_thread = None
        self.current_frame = None
        self.recognition_active = False
        self.last_recognition_time = 0
        self.auto_register_enabled = True
        self.attendance_registered = False
        self.recognized_worker = None
        self.model_available = None
        self._last_recognition_result = False
        self.professional_model_available = None
        self.yolo11_available = None
        self.models_checked = False
        self._active_dialog = None  # Guard anti-dialog duplicado

        self.init_ui()
        self.setup_photos_database()
        self._load_last_registration()

        self.recognition_thread = RecognitionThread(self)
        self.recognition_thread.results_ready.connect(self.on_recognition_results)

        # Flujo Manual: La cámara espera al botón ACTIVAR
        QTimer.singleShot(1000, self.init_face_recognition)

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def init_ui(self):
        self.setWindowTitle(
            f"Safe Link Monitoring - {self.trabajador.nombre} {self.trabajador.apellido}"
        )
        self.setMinimumSize(1100, 700)
        self.resize(1280, 780)

        self.setStyleSheet(f"""
            QMainWindow {{ background: {_COLORS['bg_dark']}; }}
            QScrollBar:vertical {{
                background: {_COLORS['bg_card']}; width: 8px; border-radius: 4px;
            }}
            QScrollBar::handle:vertical {{
                background: #374151; border-radius: 4px; min-height: 20px;
            }}
        """)
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(_COLORS["bg_dark"]))
        palette.setColor(QPalette.WindowText, QColor(_COLORS["text"]))
        self.setPalette(palette)

        root = QWidget()
        self.setCentralWidget(root)
        root_lay = QVBoxLayout(root)
        root_lay.setSpacing(0)
        root_lay.setContentsMargins(0, 0, 0, 0)

        # ---------- Header ----------
        header = QFrame()
        header.setFixedHeight(64)
        header.setStyleSheet(f"""
            QFrame {{
                background: {_COLORS['bg_dark']};
                border-bottom: 1px solid {_COLORS['border']};
            }}
        """)
        h_lay = QHBoxLayout(header)
        h_lay.setContentsMargins(24, 0, 24, 0)

        brand = QLabel("SAFE LINK")
        brand.setFont(self._font(15, True))
        brand.setStyleSheet(f"color: {_COLORS['accent']}; background: transparent;")
        h_lay.addWidget(brand)

        sep = QLabel("|")
        sep.setStyleSheet(
            f"color: {_COLORS['border']}; background: transparent; font-size: 18px;"
        )
        h_lay.addWidget(sep)

        page = QLabel("Control de Asistencia")
        page.setFont(self._font(11))
        page.setStyleSheet(f"color: {_COLORS['text_dim']}; background: transparent;")
        h_lay.addWidget(page)

        h_lay.addStretch()

        dot = QLabel()
        dot.setFixedSize(8, 8)
        dot.setStyleSheet(f"background: {_COLORS['success']}; border-radius: 4px;")
        h_lay.addWidget(dot)

        user_lbl = QLabel(f"{self.trabajador.nombre} {self.trabajador.apellido}")
        user_lbl.setFont(self._font(11))
        user_lbl.setStyleSheet(
            f"color: {_COLORS['text']}; background: transparent; margin-left: 6px;"
        )
        h_lay.addWidget(user_lbl)

        # Separador visual
        sep2 = QLabel("|")
        sep2.setStyleSheet(
            f"color: {_COLORS['border']}; background: transparent; font-size: 16px; margin: 0 8px;"
        )
        h_lay.addWidget(sep2)

        # Reloj en vivo — Consolas para datos numéricos/tiempo
        self._clock_lbl = QLabel()
        self._clock_lbl.setFont(QFont("Consolas", 11))
        self._clock_lbl.setStyleSheet(
            f"color: {_COLORS['text_dim']}; background: transparent;"
        )
        h_lay.addWidget(self._clock_lbl)

        self._clock_timer = QTimer(self)
        self._clock_timer.timeout.connect(self._update_clock)
        self._clock_timer.start(1000)
        self._update_clock()

        root_lay.addWidget(header)

        # ---------- Body ----------
        body = QWidget()
        body.setStyleSheet(f"background: {_COLORS['bg_dark']};")
        b_lay = QHBoxLayout(body)
        b_lay.setSpacing(16)
        b_lay.setContentsMargins(20, 16, 20, 16)

        # ---- Left: camera ----
        cam_card = QFrame()
        cam_card.setStyleSheet(_glass_style())
        cam_lay = QVBoxLayout(cam_card)
        cam_lay.setContentsMargins(16, 16, 16, 16)
        cam_lay.setSpacing(12)

        cam_header = QHBoxLayout()
        cam_title = QLabel("Camara en vivo")
        cam_title.setFont(self._font(14, True))
        cam_title.setStyleSheet(f"color: {_COLORS['text']}; background: transparent;")
        cam_header.addWidget(cam_title)
        cam_header.addStretch()

        # Dot pulsante — visible solo cuando cámara está EN VIVO
        self._live_dot = QLabel()
        self._live_dot.setFixedSize(7, 7)
        self._live_dot.setStyleSheet(
            f"background: {_COLORS['success']}; border-radius: 3px;"
        )
        self._live_dot.hide()
        cam_header.addWidget(self._live_dot)
        cam_header.addSpacing(4)

        self._cam_badge = QLabel("OFFLINE")
        self._cam_badge.setFont(self._font(9, True))
        self._cam_badge.setStyleSheet(
            self._badge_style(_COLORS["text_muted"], "#1f2937")
        )
        cam_header.addWidget(self._cam_badge)
        cam_lay.addLayout(cam_header)

        # Timer del dot pulsante
        self._dot_timer = QTimer(self)
        self._dot_timer.setInterval(800)
        self._dot_timer.timeout.connect(self._pulse_dot)

        # Video
        self.video_label = QLabel("Presiona ACTIVAR para iniciar la camara")
        self.video_label.setAlignment(Qt.AlignCenter)
        self.video_label.setMinimumSize(560, 420)
        self.video_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.video_label.setStyleSheet(f"""
            QLabel {{
                background: #000;
                border: 1px solid {_COLORS['border']};
                border-radius: 12px;
                color: {_COLORS['text_muted']};
                font-size: 14px;
            }}
        """)
        cam_lay.addWidget(self.video_label)

        # Buttons
        btn_row = QHBoxLayout()
        btn_row.setSpacing(10)

        self.start_button = QPushButton("ACTIVAR")
        self.start_button.setStyleSheet(
            _btn_style(_COLORS["gradient_main"], "#00d2ff", "#3a86ff")
        )
        self.start_button.setCursor(Qt.PointingHandCursor)
        self.start_button.clicked.connect(self.start_camera)
        btn_row.addWidget(self.start_button)

        self.stop_button = QPushButton("DETENER CAMARA")
        self.stop_button.setStyleSheet(
            _btn_style(
                "rgba(239, 68, 68, 0.10)",
                "rgba(239, 68, 68, 0.20)",
                "rgba(239, 68, 68, 0.30)",
            )
        )
        self.stop_button.setStyleSheet(self.stop_button.styleSheet().replace(
            "color: white;", f"color: {_COLORS['danger']};"
        ))
        self.stop_button.setCursor(Qt.PointingHandCursor)
        self.stop_button.clicked.connect(self.stop_camera)
        self.stop_button.hide()  # Toggle: solo visible cuando cámara activa
        btn_row.addWidget(self.stop_button)

        cam_lay.addLayout(btn_row)

        # REGISTRAR ASISTENCIA — botón protagonista con ícono QPainter
        reg_icon = QIcon(_make_dialog_icon(_COLORS["success"], is_check=True, size=22))
        self.recognize_button = QPushButton("  REGISTRAR ASISTENCIA")
        self.recognize_button.setIcon(reg_icon)
        self.recognize_button.setIconSize(QSize(20, 20))
        self.recognize_button.setEnabled(False)
        self.recognize_button.setFixedHeight(52)
        self.recognize_button.setStyleSheet(
            _btn_style(
                "qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #10b981, stop:1 #059669)",
                "#059669",
                "#047857",
            )
        )
        self.recognize_button.setCursor(Qt.PointingHandCursor)
        self.recognize_button.clicked.connect(self.register_attendance)
        cam_lay.addWidget(self.recognize_button)

        b_lay.addWidget(cam_card, 3)

        # ---- Right: info panel ----
        info_card = QFrame()
        info_card.setStyleSheet(_glass_style())
        info_card.setFixedWidth(340)
        i_lay = QVBoxLayout(info_card)
        i_lay.setContentsMargins(16, 16, 16, 16)
        i_lay.setSpacing(14)

        # ========== STATUS HERO ==========
        self.status_hero = QFrame()
        self.status_hero.setObjectName("statusHero")
        self.status_hero.setStyleSheet(f"""
            QFrame#statusHero {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(0, 210, 255, 0.1), stop:1 rgba(58, 134, 255, 0.05));
                border: 1px solid rgba(0, 210, 255, 0.2);
                border-radius: 20px;
            }}
        """)
        sh_lay = QVBoxLayout(self.status_hero)
        sh_lay.setContentsMargins(20, 24, 20, 24)
        sh_lay.setSpacing(4)

        self.status_label = QLabel("MODO ESCANEO")
        self.status_label.setFont(self._font(8, True))
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet(
            f"color: {_COLORS['accent']}; background: transparent; letter-spacing: 2.5px;"
        )
        sh_lay.addWidget(self.status_label)

        # Arco circular de confianza (reemplaza el label plano)
        self.confidence_arc = _ConfidenceArc()
        sh_lay.addWidget(self.confidence_arc, 0, Qt.AlignCenter)

        conf_hint = QLabel("CONFIANZA")
        conf_hint.setFont(self._font(8, True))
        conf_hint.setAlignment(Qt.AlignCenter)
        conf_hint.setStyleSheet(
            f"color: {_COLORS['text_muted']}; background: transparent; letter-spacing: 3px;"
        )
        sh_lay.addWidget(conf_hint)

        i_lay.addWidget(self.status_hero)

        # ========== AVATAR AREA ==========
        avatar_area = QWidget()
        avatar_area.setFixedHeight(180)
        aa_lay = QVBoxLayout(avatar_area)
        aa_lay.setContentsMargins(0, 10, 0, 10)

        self.recognized_photo_label = QLabel("Coloca tu\nrostro\naquí")
        self.recognized_photo_label.setFixedSize(140, 140)
        self.recognized_photo_label.setAlignment(Qt.AlignCenter)
        self.recognized_photo_label.setFont(QFont("Segoe UI", 9))
        self.recognized_photo_label.setStyleSheet(f"""
            QLabel {{
                background: rgba(30, 41, 59, 0.4);
                border-radius: 16px;
                border: 2px dashed {_COLORS['border']};
                color: {_COLORS['text_muted']};
            }}
        """)
        aa_lay.addWidget(self.recognized_photo_label, 0, Qt.AlignCenter)
        i_lay.addWidget(avatar_area)

        # ========== INFO GRID ==========
        info_grid = QFrame()
        info_grid.setStyleSheet(f"""
            QFrame {{
                background: rgba(22, 27, 34, 0.4);
                border: 1px solid {_COLORS['border']};
                border-radius: 16px;
            }}
        """)
        ig_lay = QVBoxLayout(info_grid)
        ig_lay.setContentsMargins(14, 14, 14, 14)
        ig_lay.setSpacing(8)

        # Símbolos geométricos Unicode (no emojis) como indicadores de fila
        self.recognized_name_label = self._add_info_row(
            ig_lay, "◉", "NOMBRE", "--", _COLORS["accent"]
        )
        self.recognized_apellido_label = self._add_info_row(
            ig_lay, "≡", "APELLIDOS", "--", "#58a6ff"
        )
        self.recognized_zona_label = self._add_info_row(
            ig_lay, "◎", "ZONA", "--", _COLORS["warning"]
        )
        self.recognized_sucursal_label = self._add_info_row(
            ig_lay, "▪", "SUCURSAL", "--", _COLORS["success"]
        )
        self.recognized_puesto_label = self._add_info_row(
            ig_lay, "◈", "PUESTO", "--", "#bc8cff"
        )

        i_lay.addWidget(info_grid)

        # Guardar referencias para skeleton animation
        self._info_value_labels = [
            self.recognized_name_label,
            self.recognized_apellido_label,
            self.recognized_zona_label,
            self.recognized_sucursal_label,
            self.recognized_puesto_label,
        ]
        self._skeleton_active = False

        # ========== ÚLTIMO REGISTRO ==========
        last_reg_frame = QFrame()
        last_reg_frame.setStyleSheet(f"""
            QFrame {{
                background: rgba(240, 246, 252, 0.03);
                border: 1px solid {_COLORS['border']};
                border-radius: 10px;
            }}
        """)
        lr_lay = QHBoxLayout(last_reg_frame)
        lr_lay.setContentsMargins(14, 8, 14, 8)

        lr_icon = QLabel("◷")
        lr_icon.setFont(self._font(11))
        lr_icon.setStyleSheet(f"color: {_COLORS['text_muted']}; background: transparent;")
        lr_lay.addWidget(lr_icon)

        self._last_reg_lbl = QLabel("Sin registros hoy")
        self._last_reg_lbl.setFont(QFont("Consolas", 9))
        self._last_reg_lbl.setStyleSheet(
            f"color: {_COLORS['text_dim']}; background: transparent;"
        )
        lr_lay.addWidget(self._last_reg_lbl)
        lr_lay.addStretch()
        i_lay.addWidget(last_reg_frame)

        i_lay.addStretch()

        # ========== LOGOUT ==========
        logout_btn = QPushButton("Cerrar Sesión")
        logout_btn.setCursor(Qt.PointingHandCursor)
        logout_btn.setStyleSheet(f"""
            QPushButton {{
                background: rgba(255, 75, 92, 0.08);
                color: {_COLORS['danger']};
                border: 1px solid rgba(255, 75, 92, 0.2);
                border-radius: 12px;
                padding: 12px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }}
            QPushButton:hover {{
                background: rgba(255, 75, 92, 0.18);
                border: 1px solid rgba(255, 75, 92, 0.4);
            }}
        """)
        logout_btn.clicked.connect(self.logout)
        i_lay.addWidget(logout_btn)

        b_lay.addWidget(info_card, 0)
        root_lay.addWidget(body)

        # Timer for display refresh
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_frame)
        self.update_timer.start(33)

    # helpers

    @staticmethod
    def _font(size, bold=False):
        f = QFont("Segoe UI", size)
        f.setBold(bold)
        return f

    @staticmethod
    def _badge_style(fg, bg):
        return f"""
            color: {fg}; background: {bg};
            border-radius: 6px; padding: 4px 10px;
            font-size: 9px; font-weight: 700; letter-spacing: 1px;
        """

    def _add_info_row(
        self, parent_layout, icon, label_text, default="--", accent_color=None
    ):
        row = QFrame()
        accent = accent_color or _COLORS["accent"]
        row.setStyleSheet(f"""
            QFrame {{
                background: rgba(240, 246, 252, 0.03);
                border: none;
                border-radius: 10px;
            }}
        """)
        rl = QHBoxLayout(row)
        rl.setContentsMargins(12, 8, 12, 8)
        rl.setSpacing(10)

        # Accent dot
        dot = QLabel()
        dot.setFixedSize(4, 28)
        dot.setStyleSheet(f"background: {accent}; border-radius: 2px;")
        rl.addWidget(dot)

        # Icon
        icon_lbl = QLabel(icon)
        icon_lbl.setFont(self._font(11))
        icon_lbl.setFixedWidth(24)
        icon_lbl.setStyleSheet("background: transparent; border: none;")
        rl.addWidget(icon_lbl)

        # Text column
        text_col = QVBoxLayout()
        text_col.setSpacing(0)

        lbl = QLabel(label_text)
        lbl.setFont(self._font(7, True))
        lbl.setStyleSheet(
            f"color: {_COLORS['text_muted']}; background: transparent; letter-spacing: 1px;"
        )
        text_col.addWidget(lbl)

        val = QLabel(default)
        val.setFont(self._font(11, True))
        val.setStyleSheet(f"color: {_COLORS['text']}; background: transparent;")
        val.setWordWrap(True)
        text_col.addWidget(val)

        rl.addLayout(text_col)
        rl.addStretch()

        parent_layout.addWidget(row)
        return val

    # ------------------------------------------------------------------
    # Camera
    # ------------------------------------------------------------------

    def start_camera(self):
        if self.camera_thread is None:
            self.start_button.setEnabled(False)
            self.start_button.setText("Iniciando...")
            self._set_status("Conectando camara...", "warning")
            self._cam_badge.setText("CONECTANDO")
            self._cam_badge.setStyleSheet(
                self._badge_style(_COLORS["warning"], "#422006")
            )
            QApplication.processEvents()
            self.camera_thread = CameraThread(0)
            self.camera_thread.frame_ready.connect(self.on_frame_received)
            self.camera_thread.camera_started.connect(self.on_camera_started)
            QTimer.singleShot(50, self.camera_thread.start_camera)
            # Toggle visual: mostrar DETENER, ocultar ACTIVAR
            self.start_button.hide()
            self.stop_button.show()

    def on_camera_started(self, success):
        if success:

            # Cuenta regresiva de 5 segundos para acomodarse
            self._preparacion_count = 5
            self._timer_preparacion = QTimer(self)
            self._timer_preparacion.setInterval(1000)
            self._timer_preparacion.timeout.connect(self._update_preparation_countdown)
            self._timer_preparacion.start()

            self._update_preparation_countdown()  # Primer llamado inmediato
        else:
            QMessageBox.critical(
                self,
                "Error de Camara",
                "No se pudo acceder a la camara.\n\n"
                "Verifica que no este siendo usada por otra app\n"
                "y que tenga permisos de acceso.",
            )
            self.camera_thread = None
            self.start_button.setEnabled(True)
            # Toggle visual: restaurar ACTIVAR
            self.stop_button.hide()
            self.start_button.show()

    def _update_preparation_countdown(self):
        if self._preparacion_count > 0:
            self._set_status(
                f"Acomodate frente a la camara... {self._preparacion_count}s", "warning"
            )
            self._cam_badge.setText(f"ESPERA {self._preparacion_count}S")
            self._cam_badge.setStyleSheet(self._badge_style("#fff", _COLORS["warning"]))
            self._preparacion_count -= 1
        else:
            self._timer_preparacion.stop()
            self._set_status("Buscando rostro - Escaneando...", "success")
            self._cam_badge.setText("EN VIVO")
            self._cam_badge.setStyleSheet(self._badge_style("#fff", _COLORS["success"]))
            self.recognize_button.setEnabled(True)
            # Dot pulsante: indicar cámara activa
            self._live_dot.show()
            self._dot_timer.start()
            # Skeleton en info panel mientras no hay reconocimiento
            self._set_info_skeleton(True)
            # Iniciar el hilo de reconocimiento después de la espera
            if not self.recognition_thread.isRunning():
                self.recognition_thread.start()

    def stop_camera(self):
        if self.camera_thread:
            self.camera_thread.stop()
            self.camera_thread = None
            self.start_button.setEnabled(True)
            self.recognize_button.setEnabled(False)
            self._set_status("Camara detenida", "neutral")
            self._cam_badge.setText("OFFLINE")
            self._cam_badge.setStyleSheet(
                self._badge_style(_COLORS["text_muted"], "#1f2937")
            )
            # Toggle visual: restaurar ACTIVAR, ocultar DETENER
            self.stop_button.hide()
            self.start_button.show()
            # Dot pulsante: apagar y ocultar
            self._dot_timer.stop()
            self._live_dot.hide()
            # Desactivar skeleton
            self._set_info_skeleton(False)
            self.video_label.clear()
            self.video_label.setText("Presiona ACTIVAR para iniciar la camara")
            self.current_frame = None
        if hasattr(self, "recognition_thread") and self.recognition_thread.isRunning():
            self.recognition_thread.set_frame(None)

    def on_frame_received(self, frame: np.ndarray):
        if frame is None or frame.size == 0:
            return
        self.current_frame = frame
        if not hasattr(self, "_fdc"):
            self._fdc = 0
        self._fdc += 1
        if self._fdc >= 2:
            self._fdc = 0
            try:
                self.update_video_display(frame)
            except Exception:
                pass
        if hasattr(self, "recognition_thread") and self.recognition_thread.isRunning():
            if not self.recognition_thread.processing:
                t = datetime.now().timestamp()
                if not hasattr(self, "_lfu"):
                    self._lfu = 0
                if t - self._lfu >= 0.5:
                    self._lfu = t
                    self.recognition_thread.set_frame(frame)

    def update_video_display(self, frame: np.ndarray):
        lbl = self.video_label
        tw, th = lbl.width() - 4, lbl.height() - 4
        if tw < 10 or th < 10:
            return
        h, w = frame.shape[:2]
        s = min(tw / w, th / h)
        nw, nh = int(w * s), int(h * s)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        qimg = QImage(rgb.data, nw, nh, 3 * nw, QImage.Format_RGB888)
        # --- HUD OVERLAY ---
        painter = QPainter(qimg)
        painter.setRenderHint(QPainter.Antialiasing)

        # Corner Brackets [ ]
        p_color = QColor(
            _COLORS["accent"] if not self.attendance_registered else _COLORS["success"]
        )
        p_color.setAlpha(180)
        pen = painter.pen()
        pen.setColor(p_color)
        pen.setWidth(2)
        painter.setPen(pen)

        m = 40  # Margin
        L = 30  # Length
        # Top Left
        painter.drawLine(m, m, m + L, m)
        painter.drawLine(m, m, m, m + L)
        # Top Right
        painter.drawLine(nw - m, m, nw - m - L, m)
        painter.drawLine(nw - m, m, nw - m, m + L)
        # Bottom Left
        painter.drawLine(m, nh - m, m + L, nh - m)
        painter.drawLine(m, nh - m, m, nh - m - L)
        # Bottom Right
        painter.drawLine(nw - m, nh - m, nw - m - L, nh - m)
        painter.drawLine(nw - m, nh - m, nw - m, nh - m - L)

        # Scanning laser line (animated by time)
        if not self.attendance_registered:
            ty = int((datetime.now().timestamp() * 150) % (nh - 2 * m)) + m
            laser_grad = QLinearGradient(m, ty, nw - m, ty)
            laser_grad.setColorAt(0, QColor(0, 0, 0, 0))
            laser_grad.setColorAt(0.5, p_color)
            laser_grad.setColorAt(1, QColor(0, 0, 0, 0))
            painter.fillRect(m, ty, nw - 2 * m, 2, QBrush(laser_grad))

        painter.end()

        if lbl.text():
            lbl.setText("")
            lbl.setStyleSheet(
                f"border-radius: 12px; background: #000; border: 1px solid {_COLORS['border']};"
            )

        lbl.setPixmap(QPixmap.fromImage(qimg))

    def update_frame(self):
        if self.current_frame is not None:
            self.update_video_display(self.current_frame)

    # ------------------------------------------------------------------
    # Loading animation (dots animados durante inicialización)
    # ------------------------------------------------------------------

    def _start_loading_animation(self, base_text: str):
        """Anima puntos suspensivos en el status label para indicar carga."""
        self._loading_base = base_text
        self._loading_dots = 0
        if not hasattr(self, "_loading_timer"):
            self._loading_timer = QTimer(self)
            self._loading_timer.timeout.connect(self._tick_loading_anim)
        self._loading_timer.start(380)

    def _stop_loading_animation(self):
        if hasattr(self, "_loading_timer"):
            self._loading_timer.stop()

    def _tick_loading_anim(self):
        self._loading_dots = (self._loading_dots + 1) % 4
        dots = "." * self._loading_dots
        self._set_status(self._loading_base + dots, "warning")

    # ------------------------------------------------------------------
    # Status helpers
    # ------------------------------------------------------------------

    def _set_status(self, text, level="neutral"):
        lvl_colors = {
            "success": (
                "#10b981",
                "rgba(16, 185, 129, 0.15)",
                "rgba(16, 185, 129, 0.3)",
            ),
            "warning": (
                "#f59e0b",
                "rgba(245, 158, 11, 0.1)",
                "rgba(245, 158, 11, 0.2)",
            ),
            "danger": ("#ef4444", "rgba(239, 68, 68, 0.1)", "rgba(239, 68, 68, 0.2)"),
            "neutral": (
                _COLORS["accent"],
                "rgba(0, 210, 255, 0.1)",
                "rgba(0, 210, 255, 0.2)",
            ),
        }
        fg, bg, bc = lvl_colors.get(level, lvl_colors["neutral"])
        self.status_label.setText(text.upper())
        self.status_label.setStyleSheet(
            f"color: {fg}; background: transparent; letter-spacing: 2px;"
        )

        if hasattr(self, "status_hero"):
            self.status_hero.setStyleSheet(f"""
                QFrame#statusHero {{
                    background: {bg};
                    border: 1.5px solid {bc};
                    border-radius: 20px;
                }}
            """)

    # ------------------------------------------------------------------
    # Recognition results
    # ------------------------------------------------------------------

    def on_recognition_results(self, reconocido, confianza, info_empleado, metodo):
        if reconocido and info_empleado:
            self._last_recognition_result = True
            self.last_recognition_time = datetime.now().timestamp() * 1000

            pct_val = confianza * 100
            arc_color = (
                _COLORS["success"] if pct_val >= 80
                else _COLORS["warning"] if pct_val >= 60
                else _COLORS["danger"]
            )
            self.confidence_arc.set_value(pct_val, arc_color)
            self._set_info_skeleton(False)
            self._set_status(f"Identificado via {metodo}", "success")

            self.recognized_name_label.setText(info_empleado.get("nombre", "N/A"))
            self.recognized_apellido_label.setText(info_empleado.get("apellido", ""))
            self.recognized_zona_label.setText(info_empleado.get("zona", "N/A"))
            self.recognized_sucursal_label.setText(info_empleado.get("sucursal", "N/A"))
            self.recognized_puesto_label.setText(info_empleado.get("puesto", "N/A"))

            eid = info_empleado.get("employee_id", 0)
            photo_path = get_photo_path(eid)
            if photo_path and Path(photo_path).exists():
                px = QPixmap(str(photo_path))
                if not px.isNull():
                    sz = self.recognized_photo_label.size()
                    t = min(sz.width(), sz.height()) - 8
                    self.recognized_photo_label.setPixmap(
                        px.scaled(t, t, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                    )
                    self.recognized_photo_label.setStyleSheet(f"""
                        QLabel {{
                            background: rgba(30, 41, 59, 0.6);
                            border: 3px solid {_COLORS['success']};
                            border-radius: 16px;
                        }}
                    """)

            if (
                confianza >= 0.85
                and self.auto_register_enabled
                and not self.attendance_registered
            ):
                self.auto_register_attendance_with_model(info_empleado, confianza)
        else:
            t = datetime.now().timestamp() * 1000
            if t - self.last_recognition_time > 3000:
                self._last_recognition_result = False
                self._set_status("Buscando rostro...", "warning")
                self.confidence_arc.reset()
                # Reset completo del panel — empty state
                for lbl in (
                    self.recognized_name_label,
                    self.recognized_apellido_label,
                    self.recognized_zona_label,
                    self.recognized_sucursal_label,
                    self.recognized_puesto_label,
                ):
                    lbl.setText("--")
                self.recognized_photo_label.clear()
                self.recognized_photo_label.setText("Coloca tu\nrostro\naquí")
                self.recognized_photo_label.setStyleSheet(f"""
                    QLabel {{
                        background: rgba(30, 41, 59, 0.4);
                        border-radius: 16px;
                        border: 2px dashed {_COLORS['border']};
                        color: {_COLORS['text_muted']};
                    }}
                """)

    # ------------------------------------------------------------------
    # Setup & init
    # ------------------------------------------------------------------

    def setup_photos_database(self):
        root_dir = Path(__file__).resolve().parent.parent.parent
        database_fotos_dir = root_dir / "database_fotos"
        photos_dir = database_fotos_dir / "photos"
        json_path = database_fotos_dir / "json" / "employees_db.json"

        if photos_dir.exists() and json_path.exists():
            logger.info(f"DB fotos: {len(list(photos_dir.glob('*.jpeg')))} fotos")
            return

        from utils.process_photos import process_photos_folder

        photos_old = root_dir.parent / "photos"
        if photos_old.exists() and photos_old.is_dir():
            QTimer.singleShot(
                500, lambda: process_photos_folder(photos_old, database_fotos_dir)
            )

    def init_face_recognition(self):
        self._set_status("Analizando entorno...", "warning")
        _lazy_load_face_recognition()
        root_dir = Path(__file__).resolve().parent.parent.parent
        model_path = (
            root_dir / "data" / "models" / "models" / "face_recognition_model.pt"
        )
        metadata_path = (
            root_dir / "data" / "models" / "models" / "employee_metadata.json"
        )
        # Fallback a ubicación alternativa si no existe
        if not model_path.exists():
            base_dir = Path(__file__).parent.parent
            model_path = base_dir / "models" / "face_recognition_model.pt"
            metadata_path = base_dir / "models" / "employee_metadata.json"

        self.model_available = model_path.exists() and metadata_path.exists()
        QTimer.singleShot(100, self._init_face_recognition_async)

    def _init_face_recognition_async(self):
        if inicializar_sistema_facial is None:
            _lazy_load_face_recognition()
        if FACE_RECOGNITION_AVAILABLE and inicializar_sistema_facial:
            try:
                # Spinner animado durante carga de fotos (operación >300ms)
                self._start_loading_animation("REGISTRANDO FOTOS")
                QApplication.processEvents()
                try:
                    from utils.register_photos import register_photos_from_database

                    register_photos_from_database()
                except Exception as e:
                    logger.warning(f"Error registrando fotos: {e}")
                # Spinner animado durante carga de modelos ONNX
                self._start_loading_animation("INICIALIZANDO MODELOS")
                QApplication.processEvents()
                result = inicializar_sistema_facial()
                self._stop_loading_animation()
                if result:
                    self._set_status("Sistema listo", "success")
                else:
                    self._set_status("Sistema parcialmente listo", "warning")
            except Exception as e:
                self._stop_loading_animation()
                logger.error(f"Error init reconocimiento: {e}", exc_info=True)
                self._set_status("Error en reconocimiento", "danger")
        else:
            self._set_status("Reconocimiento no disponible", "warning")

    # ------------------------------------------------------------------
    # Attendance
    # ------------------------------------------------------------------

    def auto_register_attendance_with_model(
        self, info_empleado: Dict, confianza: float
    ):
        if self.attendance_registered:
            return
        try:
            eid = info_empleado.get("employee_id", 0)
            db = get_db_session()
            trab = None
            try:
                trab = (
                    db.query(Trabajador).filter(Trabajador.employee_id == eid).first()
                )
                if not trab:
                    parts = info_empleado.get("nombre", "").split()
                    nombre = parts[0] if parts else "Empleado"
                    apellido = " ".join(parts[1:]) if len(parts) > 1 else "Desconocido"
                    trab = Trabajador(
                        usuario=f"empleado_{eid}",
                        password_hash="",
                        nombre=nombre,
                        apellido=apellido,
                        sucursal=info_empleado.get("sucursal", "N/A"),
                        zona=info_empleado.get("zona", "N/A"),
                        puesto=info_empleado.get("puesto", "N/A"),
                        employee_id=eid,
                        activo=True,
                    )
                    db.add(trab)
                    db.commit()
                    db.refresh(trab)
            except Exception as e:
                logger.error(f"Error BD: {e}")
            finally:
                db.close()
            if trab:
                self.recognized_worker = trab
                self._register_attendance_silent(confianza, trab, info_empleado)
        except Exception as e:
            logger.error(f"Error auto-registro: {e}")

    def _register_attendance_silent(self, confianza, trabajador, info_empleado=None):
        try:
            db = get_db_session()
            try:
                hoy = datetime.now().date()
                tid = (
                    trabajador.id
                    if hasattr(trabajador, "id") and trabajador.id
                    else None
                )
                ultimo = None
                if tid:
                    ultimo = (
                        db.query(RegistroAsistencia)
                        .filter(
                            RegistroAsistencia.trabajador_id == tid,
                            func.date(RegistroAsistencia.timestamp) == hoy,
                        )
                        .order_by(RegistroAsistencia.timestamp.desc())
                        .first()
                    )
                tipo = "salida" if ultimo and ultimo.tipo == "entrada" else "entrada"
                reg = RegistroAsistencia(
                    trabajador_id=tid,
                    timestamp=datetime.now(),
                    tipo=tipo,
                    reconocimiento_facial=True,
                    confianza=confianza,
                    ubicacion=(
                        info_empleado.get("sucursal", "N/A") if info_empleado else "N/A"
                    ),
                )
                db.add(reg)
                db.commit()
                self.attendance_registered = True
                self._update_last_reg(tipo, datetime.now())
                nombre = (
                    info_empleado.get("nombre", "Trabajador")
                    if info_empleado
                    else "Trabajador"
                )
                # Guard anti-dialog duplicado: no mostrar si ya hay uno activo
                dialog_bloqueado = (
                    self._active_dialog is not None
                    and self._active_dialog.isVisible()
                )
                if not dialog_bloqueado:
                    dlg = AttendanceDialog(
                        tipo,
                        nombre,
                        f"{confianza*100:.0f}",
                        datetime.now().strftime("%H:%M:%S"),
                        parent=self,
                    )
                    self._active_dialog = dlg
                    dlg.show()

                # --- INTEGRACIÓN SUPABASE ---
                ok_cloud = False
                try:
                    sb = get_supabase_client()
                    if sb:
                        # Buscamos el ID único del empleado en Supabase
                        emp_data = (
                            sb.table("empleados")
                            .select("id")
                            .eq("employee_id", trabajador.employee_id)
                            .execute()
                        )
                        if emp_data.data:
                            supabase_emp_id = emp_data.data[0]["id"]
                            sb.table("asistencias").insert(
                                {
                                    "empleado_id": supabase_emp_id,
                                    "tipo": tipo,
                                    "confianza": float(confianza),
                                    "ubicacion": (
                                        info_empleado.get("sucursal", "N/A")
                                        if info_empleado
                                        else "N/A"
                                    ),
                                }
                            ).execute()
                            logger.info(
                                f"✅ Asistencia sincronizada con Supabase para {trabajador.nombre}"
                            )
                            ok_cloud = True
                except Exception as es:
                    logger.error(f"❌ Error sincronizando con Supabase: {es}")

                # Feedback visual y Auto-Logout (Modo SaaS Web)
                msg = (
                    "REGISTRO SAAS EXITOSO"
                    if ok_cloud
                    else "IDENTIDAD VERIFICADA (LOCAL)"
                )
                self._set_status(msg, "success")

                self._cam_badge.setText("SINCRO OK")
                self._cam_badge.setStyleSheet(
                    self._badge_style("#ffffff", _COLORS["success"])
                )

                # Cerrar sesión automáticamente tras 5 segundos
                QTimer.singleShot(5000, self.logout)
                # ----------------------------
            except Exception as e:
                db.rollback()
                logger.error(f"Error registro: {e}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error registro silencioso: {e}")

    def register_attendance(self):
        if self.current_frame is None:
            QMessageBox.warning(
                self, "Error", "No hay imagen de camara. Activa la camara primero."
            )
            return
        if reconocer_desde_frame is None:
            _lazy_load_face_recognition()
        if not FACE_RECOGNITION_AVAILABLE or reconocer_desde_frame is None:
            QMessageBox.warning(
                self, "Error", "Sistema de reconocimiento no disponible."
            )
            return
        reconocido, confianza, idx = reconocer_desde_frame(
            self.current_frame,
            trabajador_id=self.trabajador.id,
            embedding_idx=self.trabajador.embedding_idx,
        )
        if not reconocido or confianza < 0.85:
            QMessageBox.warning(
                self,
                "Reconocimiento Fallido",
                f"No se pudo reconocer al trabajador.\n"
                f"Confianza: {confianza*100:.1f}%\n\n"
                "Asegurate de estar bien iluminado y mirar a la camara.",
            )
            return
        db = get_db_session()
        try:
            today = datetime.now().date()
            last = (
                db.query(RegistroAsistencia)
                .filter(
                    RegistroAsistencia.trabajador_id == self.trabajador.id,
                    RegistroAsistencia.timestamp
                    >= datetime.combine(today, datetime.min.time()),
                )
                .order_by(RegistroAsistencia.timestamp.desc())
                .first()
            )
            tipo = "salida" if last and last.tipo == "entrada" else "entrada"
            reg = RegistroAsistencia(
                trabajador_id=self.trabajador.id,
                tipo=tipo,
                reconocimiento_facial=True,
                confianza=confianza,
                ubicacion=self.trabajador.sucursal or "N/A",
            )
            db.add(reg)
            db.commit()
            self.attendance_registered = True
            self._update_last_reg(tipo, datetime.now())
            nombre = f"{self.trabajador.nombre} {self.trabajador.apellido}"
            # Guard anti-dialog duplicado
            if not (self._active_dialog is not None and self._active_dialog.isVisible()):
                dlg = AttendanceDialog(
                    tipo,
                    nombre,
                    f"{confianza*100:.0f}",
                    datetime.now().strftime("%H:%M:%S"),
                    parent=self,
                )
                self._active_dialog = dlg
                dlg.show()
            self._set_status(
                f"{tipo.upper()} registrada - Cerrando en 5s...", "success"
            )

            # --- INTEGRACIÓN SUPABASE ---
            try:
                sb = get_supabase_client()
                if sb:
                    emp_data = (
                        sb.table("empleados")
                        .select("id")
                        .eq("employee_id", self.trabajador.employee_id)
                        .execute()
                    )
                    if emp_data.data:
                        supabase_emp_id = emp_data.data[0]["id"]
                        sb.table("asistencias").insert(
                            {
                                "empleado_id": supabase_emp_id,
                                "tipo": tipo,
                                "confianza": float(confianza),
                                "ubicacion": self.trabajador.sucursal or "N/A",
                            }
                        ).execute()
                        logger.info(f"✅ Asistencia manual sincronizada con Supabase")
            except Exception as es:
                logger.error(f"❌ Error sincronizando manual con Supabase: {es}")
            # ----------------------------

            # Auto-Logout tras 5 segundos para el modo Check&Go
            QTimer.singleShot(5000, self.logout)
        except Exception as e:
            db.rollback()
            QMessageBox.critical(self, "Error", f"Error al registrar:\n{e}")
        finally:
            db.close()

    # ------------------------------------------------------------------
    # Reloj en vivo
    # ------------------------------------------------------------------

    def _update_clock(self):
        self._clock_lbl.setText(datetime.now().strftime("%H:%M:%S"))

    # ------------------------------------------------------------------
    # Dot pulsante de cámara
    # ------------------------------------------------------------------

    def _pulse_dot(self):
        self._live_dot.setVisible(not self._live_dot.isVisible())

    # ------------------------------------------------------------------
    # Skeleton animation en info grid
    # ------------------------------------------------------------------

    def _set_info_skeleton(self, active: bool):
        self._skeleton_active = active
        if active:
            if not hasattr(self, "_skel_timer"):
                self._skel_timer = QTimer(self)
                self._skel_timer.setInterval(550)
                self._skel_timer.timeout.connect(self._pulse_skeleton)
                self._skel_phase = False
            for lbl in self._info_value_labels:
                if lbl.text() in ("--", "· · ·"):
                    lbl.setText("· · ·")
            self._skel_timer.start()
        else:
            if hasattr(self, "_skel_timer"):
                self._skel_timer.stop()
            for lbl in self._info_value_labels:
                if lbl.text() == "· · ·":
                    lbl.setText("--")
                    lbl.setStyleSheet(
                        f"color: {_COLORS['text']}; background: transparent;"
                    )

    def _pulse_skeleton(self):
        self._skel_phase = not self._skel_phase
        color = _COLORS["text_dim"] if self._skel_phase else _COLORS["text_muted"]
        for lbl in self._info_value_labels:
            if lbl.text() == "· · ·":
                lbl.setStyleSheet(f"color: {color}; background: transparent;")

    # ------------------------------------------------------------------
    # Último registro del día
    # ------------------------------------------------------------------

    def _load_last_registration(self):
        """Carga el último registro de hoy para el trabajador logueado."""
        try:
            db = get_db_session()
            hoy = datetime.now().date()
            last = (
                db.query(RegistroAsistencia)
                .filter(
                    RegistroAsistencia.trabajador_id == self.trabajador.id,
                    func.date(RegistroAsistencia.timestamp) == hoy,
                )
                .order_by(RegistroAsistencia.timestamp.desc())
                .first()
            )
            db.close()
            if last:
                self._update_last_reg(last.tipo, last.timestamp)
            else:
                self._last_reg_lbl.setText("Sin registros hoy")
        except Exception:
            self._last_reg_lbl.setText("Sin registros hoy")

    def _update_last_reg(self, tipo: str, ts):
        """Actualiza el label de último registro con tipo y hora."""
        hora = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        tipo_fmt = tipo.upper()
        self._last_reg_lbl.setText(f"{tipo_fmt}  {hora}")
        color = _COLORS["success"] if tipo_fmt == "ENTRADA" else _COLORS["accent"]
        self._last_reg_lbl.setStyleSheet(
            f"color: {color}; background: transparent; font-weight: 700;"
        )

    # ------------------------------------------------------------------

    def logout(self):
        self.stop_camera()
        self.close()
        from windows.login_window import LoginWindow

        login_window = LoginWindow()
        login_window.show()

    def closeEvent(self, event):
        self.stop_camera()
        if hasattr(self, "recognition_thread"):
            self.recognition_thread.stop()
        event.accept()
