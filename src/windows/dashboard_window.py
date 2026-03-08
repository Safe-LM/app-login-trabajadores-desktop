"""
Ventana principal del dashboard con cámara y reconocimiento facial.
"""
import logging
import threading

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QMessageBox, QApplication, QGraphicsDropShadowEffect,
    QSizePolicy
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, QSize
from PyQt5.QtGui import QImage, QPixmap, QFont, QPalette, QColor, QPainter, QLinearGradient, QBrush
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
            FACE_RECOGNITION_AVAILABLE as _available
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
    'bg_dark': '#0a0f1a',
    'bg_card': '#111827',
    'bg_card_alt': '#1a2332',
    'border': '#1f2937',
    'border_accent': '#6366f1',
    'text': '#e2e8f0',
    'text_dim': '#94a3b8',
    'text_muted': '#64748b',
    'accent': '#6366f1',
    'accent_dark': '#4f46e5',
    'success': '#10b981',
    'warning': '#f59e0b',
    'danger': '#ef4444',
}

def _card_style(extra=""):
    return f"""
        QFrame {{
            background: {_COLORS['bg_card']};
            border: 1px solid {_COLORS['border']};
            border-radius: 16px;
            {extra}
        }}
    """

def _btn_style(color, hover, pressed=None):
    pressed = pressed or hover
    return f"""
        QPushButton {{
            background: {color};
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 20px;
            font-size: 13px;
            font-weight: 600;
        }}
        QPushButton:hover {{ background: {hover}; }}
        QPushButton:pressed {{ background: {pressed}; }}
        QPushButton:disabled {{ background: #374151; color: #6b7280; }}
    """


# ---------------------------------------------------------------------------
# Diálogo personalizado de asistencia
# ---------------------------------------------------------------------------

class AttendanceDialog(QWidget):
    """Diálogo premium personalizado para registro de asistencia."""

    def __init__(self, tipo, nombre, confianza, hora, parent=None):
        super().__init__(parent, Qt.Window | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
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
                background: qlineargradient(x1:0,y1:0,x2:0,y2:1,
                    stop:0 #111827, stop:1 #0f172a);
                border: 1px solid #2d3748;
                border-radius: 20px;
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
        accent = _COLORS['success'] if is_entrada else _COLORS['accent']
        icon_text = "✓" if is_entrada else "↩"

        # Icon circle
        icon_lbl = QLabel(icon_text)
        icon_lbl.setFixedSize(56, 56)
        icon_lbl.setAlignment(Qt.AlignCenter)
        icon_lbl.setFont(QFont("Segoe UI", 22, QFont.Bold))
        icon_lbl.setStyleSheet(f"""
            background: {accent};
            color: white;
            border-radius: 28px;
        """)
        cl.addWidget(icon_lbl, 0, Qt.AlignCenter)
        cl.addSpacing(14)

        # Title
        title = QLabel(f"{tipo.upper()} Registrada")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet(f"color: {_COLORS['text']}; background:transparent;")
        cl.addWidget(title)
        cl.addSpacing(16)

        # Info rows
        for label, value, color in [
            ("Empleado", nombre, _COLORS['text']),
            ("Confianza", f"{confianza}%", accent),
            ("Hora", hora, _COLORS['text_dim']),
        ]:
            row = QHBoxLayout()
            row.setContentsMargins(0, 4, 0, 4)
            lk = QLabel(label)
            lk.setFont(QFont("Segoe UI", 11))
            lk.setStyleSheet(f"color: {_COLORS['text_muted']}; background:transparent;")
            row.addWidget(lk)
            row.addStretch()
            vk = QLabel(value)
            vk.setFont(QFont("Segoe UI", 11, QFont.Bold))
            vk.setStyleSheet(f"color: {color}; background:transparent;")
            row.addWidget(vk)
            cl.addLayout(row)

        cl.addSpacing(20)

        # OK button
        ok_btn = QPushButton("Aceptar")
        ok_btn.setFont(QFont("Segoe UI", 11, QFont.Bold))
        ok_btn.setCursor(Qt.PointingHandCursor)
        ok_btn.setStyleSheet(f"""
            QPushButton {{
                background: {accent};
                color: white;
                border: none;
                border-radius: 10px;
                padding: 12px;
            }}
            QPushButton:hover {{ background: {_COLORS['accent_dark']}; }}
        """)
        ok_btn.clicked.connect(self.close)
        cl.addWidget(ok_btn)

        outer.addWidget(card)

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
                            frame = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
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
                            f = self.current_frame.copy() if self.current_frame is not None else None
                        if f is not None:
                            self._process_frame(f)
                    except Exception as e:
                        msg = str(e)
                        if "1114" in msg or "DLL" in msg:
                            self.process_interval = min(self.process_interval + 0.5, 5.0)
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
            logger.warning(f"'{method}' deshabilitado: {type(error).__name__}: {msg[:80]}")
        elif count == 1:
            logger.debug(f"Error '{method}': {msg[:80]}")

    def _process_frame(self, frame):
        if self._is_same_frame(frame):
            return
        h, w = frame.shape[:2]
        mx = 480
        if h > mx or w > mx:
            s = min(mx / h, mx / w)
            frame = cv2.resize(frame, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)

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

        self.init_ui()
        self.setup_photos_database()

        self.recognition_thread = RecognitionThread(self)
        self.recognition_thread.results_ready.connect(self.on_recognition_results)
        QTimer.singleShot(500, lambda: self.recognition_thread.start())
        QTimer.singleShot(300, self.init_face_recognition)

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def init_ui(self):
        self.setWindowTitle(f"Safe Link Monitoring - {self.trabajador.nombre} {self.trabajador.apellido}")
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
        palette.setColor(QPalette.Window, QColor(_COLORS['bg_dark']))
        palette.setColor(QPalette.WindowText, QColor(_COLORS['text']))
        self.setPalette(palette)

        root = QWidget()
        self.setCentralWidget(root)
        root_lay = QVBoxLayout(root)
        root_lay.setSpacing(0)
        root_lay.setContentsMargins(0, 0, 0, 0)

        # ---------- Header ----------
        header = QFrame()
        header.setFixedHeight(56)
        header.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 {_COLORS['bg_dark']}, stop:1 {_COLORS['bg_card']});
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
        sep.setStyleSheet(f"color: {_COLORS['border']}; background: transparent; font-size: 18px;")
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
        user_lbl.setStyleSheet(f"color: {_COLORS['text']}; background: transparent; margin-left: 6px;")
        h_lay.addWidget(user_lbl)

        root_lay.addWidget(header)

        # ---------- Body ----------
        body = QWidget()
        body.setStyleSheet(f"background: {_COLORS['bg_dark']};")
        b_lay = QHBoxLayout(body)
        b_lay.setSpacing(16)
        b_lay.setContentsMargins(20, 16, 20, 16)

        # ---- Left: camera ----
        cam_card = QFrame()
        cam_card.setStyleSheet(_card_style())
        cam_lay = QVBoxLayout(cam_card)
        cam_lay.setContentsMargins(16, 16, 16, 16)
        cam_lay.setSpacing(12)

        cam_header = QHBoxLayout()
        cam_title = QLabel("Camara en vivo")
        cam_title.setFont(self._font(14, True))
        cam_title.setStyleSheet(f"color: {_COLORS['text']}; background: transparent;")
        cam_header.addWidget(cam_title)
        cam_header.addStretch()

        self._cam_badge = QLabel("OFFLINE")
        self._cam_badge.setFont(self._font(9, True))
        self._cam_badge.setStyleSheet(self._badge_style(_COLORS['text_muted'], '#1f2937'))
        cam_header.addWidget(self._cam_badge)
        cam_lay.addLayout(cam_header)

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
        self.start_button.setStyleSheet(_btn_style(_COLORS['success'], '#059669', '#047857'))
        self.start_button.setCursor(Qt.PointingHandCursor)
        self.start_button.clicked.connect(self.start_camera)
        btn_row.addWidget(self.start_button)

        self.stop_button = QPushButton("DETENER")
        self.stop_button.setEnabled(False)
        self.stop_button.setStyleSheet(_btn_style(_COLORS['danger'], '#dc2626', '#b91c1c'))
        self.stop_button.setCursor(Qt.PointingHandCursor)
        self.stop_button.clicked.connect(self.stop_camera)
        btn_row.addWidget(self.stop_button)

        cam_lay.addLayout(btn_row)

        self.recognize_button = QPushButton("REGISTRAR ASISTENCIA")
        self.recognize_button.setEnabled(False)
        self.recognize_button.setStyleSheet(_btn_style(
            'qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #6366f1, stop:1 #4f46e5)',
            '#4f46e5', '#4338ca'
        ))
        self.recognize_button.setCursor(Qt.PointingHandCursor)
        self.recognize_button.clicked.connect(self.register_attendance)
        cam_lay.addWidget(self.recognize_button)

        b_lay.addWidget(cam_card, 3)

        # ---- Right: info panel ----
        info_card = QFrame()
        info_card.setStyleSheet(_card_style())
        info_card.setFixedWidth(340)
        i_lay = QVBoxLayout(info_card)
        i_lay.setContentsMargins(16, 16, 16, 16)
        i_lay.setSpacing(14)

        # Status badge
        self._status_frame = QFrame()
        self._status_frame.setStyleSheet(f"""
            QFrame {{
                background: {_COLORS['bg_card_alt']};
                border: 1px solid {_COLORS['border']};
                border-radius: 10px;
                padding: 10px;
            }}
        """)
        sf_lay = QVBoxLayout(self._status_frame)
        sf_lay.setContentsMargins(12, 10, 12, 10)
        sf_lay.setSpacing(6)

        self.status_label = QLabel("Esperando camara...")
        self.status_label.setFont(self._font(11))
        self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setWordWrap(True)
        self.status_label.setStyleSheet(f"color: {_COLORS['text_dim']}; background: transparent;")
        sf_lay.addWidget(self.status_label)

        self.confidence_label = QLabel("--")
        self.confidence_label.setFont(self._font(28, True))
        self.confidence_label.setAlignment(Qt.AlignCenter)
        self.confidence_label.setStyleSheet(f"color: {_COLORS['text_muted']}; background: transparent;")
        sf_lay.addWidget(self.confidence_label)

        conf_hint = QLabel("CONFIANZA")
        conf_hint.setFont(self._font(8, True))
        conf_hint.setAlignment(Qt.AlignCenter)
        conf_hint.setStyleSheet(f"color: {_COLORS['text_muted']}; background: transparent; letter-spacing: 2px;")
        sf_lay.addWidget(conf_hint)

        i_lay.addWidget(self._status_frame)

        # Photo
        photo_frame = QFrame()
        photo_frame.setStyleSheet(f"""
            QFrame {{
                background: {_COLORS['bg_card_alt']};
                border: 2px solid {_COLORS['border']};
                border-radius: 12px;
            }}
        """)
        pf_lay = QVBoxLayout(photo_frame)
        pf_lay.setContentsMargins(8, 8, 8, 8)

        self.recognized_photo_label = QLabel("Sin foto")
        self.recognized_photo_label.setFixedSize(180, 180)
        self.recognized_photo_label.setAlignment(Qt.AlignCenter)
        self.recognized_photo_label.setStyleSheet(f"""
            QLabel {{
                background: {_COLORS['bg_dark']};
                border: 1px solid {_COLORS['border']};
                border-radius: 12px;
                color: {_COLORS['text_muted']};
                font-size: 11px;
            }}
        """)
        pf_lay.addWidget(self.recognized_photo_label, 0, Qt.AlignCenter)
        i_lay.addWidget(photo_frame)

        # Info fields with accent bars
        self.recognized_name_label = self._add_info_row(i_lay, "NOMBRE(S)", "--", _COLORS['accent'])
        self.recognized_apellido_label = self._add_info_row(i_lay, "APELLIDOS", "--", '#6366f1')
        self.recognized_zona_label = self._add_info_row(i_lay, "ZONA", "--", _COLORS['warning'])
        self.recognized_sucursal_label = self._add_info_row(i_lay, "SUCURSAL", "--", _COLORS['success'])
        self.recognized_puesto_label = self._add_info_row(i_lay, "PUESTO", "--", '#a78bfa')

        i_lay.addSpacing(6)

        # Stats bar
        stats_frame = QFrame()
        stats_frame.setStyleSheet(f"""
            QFrame {{
                background: {_COLORS['bg_card_alt']};
                border: 1px solid {_COLORS['border']};
                border-radius: 8px;
            }}
        """)
        stats_lay = QHBoxLayout(stats_frame)
        stats_lay.setContentsMargins(10, 6, 10, 6)
        stats_lay.setSpacing(0)
        stats_text = QLabel("56 Empleados  ·  560 Embeddings  ·  OpenCV SFace")
        stats_text.setFont(self._font(8))
        stats_text.setAlignment(Qt.AlignCenter)
        stats_text.setStyleSheet(f"color: {_COLORS['text_muted']}; background:transparent;")
        stats_lay.addWidget(stats_text)
        i_lay.addWidget(stats_frame)

        i_lay.addStretch()

        # Logout
        logout_btn = QPushButton("CERRAR SESIÓN")
        logout_btn.setCursor(Qt.PointingHandCursor)
        logout_btn.setStyleSheet(f"""
            QPushButton {{
                background: transparent;
                color: {_COLORS['danger']};
                border: 1px solid {_COLORS['danger']};
                border-radius: 10px;
                padding: 12px;
                font-size: 12px;
                font-weight: 600;
            }}
            QPushButton:hover {{
                background: rgba(239,68,68,0.15);
                border: 1px solid #f87171;
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

    def _add_info_row(self, parent_layout, label_text, default="--", accent_color=None):
        row = QFrame()
        accent = accent_color or _COLORS['accent']
        row.setStyleSheet(f"""
            QFrame {{
                background: {_COLORS['bg_card_alt']};
                border: 1px solid {_COLORS['border']};
                border-radius: 8px;
                border-left: 3px solid {accent};
            }}
        """)
        rl = QVBoxLayout(row)
        rl.setContentsMargins(12, 8, 12, 8)
        rl.setSpacing(2)

        lbl = QLabel(label_text)
        lbl.setFont(self._font(8, True))
        lbl.setStyleSheet(f"color: {_COLORS['text_muted']}; background: transparent; letter-spacing: 1px;")
        rl.addWidget(lbl)

        val = QLabel(default)
        val.setFont(self._font(12, True))
        val.setStyleSheet(f"color: {_COLORS['text']}; background: transparent;")
        val.setWordWrap(True)
        rl.addWidget(val)

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
            self._cam_badge.setStyleSheet(self._badge_style(_COLORS['warning'], '#422006'))
            QApplication.processEvents()
            self.camera_thread = CameraThread(0)
            self.camera_thread.frame_ready.connect(self.on_frame_received)
            self.camera_thread.camera_started.connect(self.on_camera_started)
            QTimer.singleShot(50, self.camera_thread.start_camera)

    def on_camera_started(self, success):
        if success:
            self.stop_button.setEnabled(True)
            self.recognize_button.setEnabled(True)
            self.start_button.setText("ACTIVAR")
            self._set_status("Camara activa - buscando rostro", "success")
            self._cam_badge.setText("EN VIVO")
            self._cam_badge.setStyleSheet(self._badge_style('#fff', _COLORS['success']))
        else:
            QMessageBox.critical(self, "Error de Camara",
                "No se pudo acceder a la camara.\n\n"
                "Verifica que no este siendo usada por otra app\n"
                "y que tenga permisos de acceso.")
            self.camera_thread = None
            self.start_button.setEnabled(True)
            self.start_button.setText("ACTIVAR")
            self._set_status("Error al iniciar camara", "danger")
            self._cam_badge.setText("ERROR")
            self._cam_badge.setStyleSheet(self._badge_style('#fff', _COLORS['danger']))

    def stop_camera(self):
        if self.camera_thread:
            self.camera_thread.stop()
            self.camera_thread = None
            self.start_button.setEnabled(True)
            self.stop_button.setEnabled(False)
            self.recognize_button.setEnabled(False)
            self._set_status("Camara detenida", "neutral")
            self._cam_badge.setText("OFFLINE")
            self._cam_badge.setStyleSheet(self._badge_style(_COLORS['text_muted'], '#1f2937'))
            self.video_label.clear()
            self.video_label.setText("Presiona ACTIVAR para iniciar la camara")
            self.current_frame = None
        if hasattr(self, 'recognition_thread') and self.recognition_thread.isRunning():
            self.recognition_thread.set_frame(None)

    def on_frame_received(self, frame: np.ndarray):
        if frame is None or frame.size == 0:
            return
        self.current_frame = frame
        if not hasattr(self, '_fdc'):
            self._fdc = 0
        self._fdc += 1
        if self._fdc >= 2:
            self._fdc = 0
            try:
                self.update_video_display(frame)
            except Exception:
                pass
        if hasattr(self, 'recognition_thread') and self.recognition_thread.isRunning():
            if not self.recognition_thread.processing:
                t = datetime.now().timestamp()
                if not hasattr(self, '_lfu'):
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
        if lbl.text():
            lbl.setText("")
            lbl.setStyleSheet(f"""
                QLabel {{
                    background: #000;
                    border: 1px solid {_COLORS['border']};
                    border-radius: 12px;
                }}
            """)
        lbl.setPixmap(QPixmap.fromImage(qimg))

    def update_frame(self):
        if self.current_frame is not None:
            self.update_video_display(self.current_frame)

    # ------------------------------------------------------------------
    # Status helpers
    # ------------------------------------------------------------------

    def _set_status(self, text, level="neutral"):
        colors = {
            'success': (_COLORS['success'], 'rgba(16,185,129,0.12)'),
            'warning': (_COLORS['warning'], 'rgba(245,158,11,0.12)'),
            'danger':  (_COLORS['danger'],  'rgba(239,68,68,0.12)'),
            'neutral': (_COLORS['text_dim'], 'transparent'),
        }
        fg, bg = colors.get(level, colors['neutral'])
        self.status_label.setText(text)
        self.status_label.setStyleSheet(f"color: {fg}; background: transparent;")
        self._status_frame.setStyleSheet(f"""
            QFrame {{
                background: {bg};
                border: 1px solid {_COLORS['border']};
                border-radius: 10px;
            }}
        """)

    # ------------------------------------------------------------------
    # Recognition results
    # ------------------------------------------------------------------

    def on_recognition_results(self, reconocido, confianza, info_empleado, metodo):
        if reconocido and info_empleado:
            self._last_recognition_result = True
            self.last_recognition_time = datetime.now().timestamp() * 1000

            pct = f"{confianza * 100:.0f}%"
            self.confidence_label.setText(pct)
            self.confidence_label.setStyleSheet(f"color: {_COLORS['success']}; background: transparent;")
            self._set_status(f"Identificado via {metodo}", "success")

            self.recognized_name_label.setText(info_empleado.get('nombre', 'N/A'))
            self.recognized_apellido_label.setText(info_empleado.get('apellido', ''))
            self.recognized_zona_label.setText(info_empleado.get('zona', 'N/A'))
            self.recognized_sucursal_label.setText(info_empleado.get('sucursal', 'N/A'))
            self.recognized_puesto_label.setText(info_empleado.get('puesto', 'N/A'))

            eid = info_empleado.get('employee_id', 0)
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
                            background: {_COLORS['bg_dark']};
                            border: 2px solid {_COLORS['success']};
                            border-radius: 10px;
                        }}
                    """)

            if confianza >= 0.85 and self.auto_register_enabled and not self.attendance_registered:
                self.auto_register_attendance_with_model(info_empleado, confianza)
        else:
            t = datetime.now().timestamp() * 1000
            if t - self.last_recognition_time > 3000:
                self._last_recognition_result = False
                self._set_status("Buscando rostro...", "warning")
                self.confidence_label.setText("--")
                self.recognized_name_label.setText("--")
                self.recognized_apellido_label.setText("--")
                self.confidence_label.setStyleSheet(f"color: {_COLORS['text_muted']}; background: transparent;")

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
            QTimer.singleShot(500, lambda: process_photos_folder(photos_old, database_fotos_dir))

    def init_face_recognition(self):
        self._set_status("Cargando reconocimiento facial...", "warning")
        _lazy_load_face_recognition()
        base_dir = Path(__file__).parent.parent
        model_path = base_dir / 'models' / 'face_recognition_model.pt'
        metadata_path = base_dir / 'models' / 'employee_metadata.json'
        self.model_available = model_path.exists() and metadata_path.exists()
        QTimer.singleShot(100, self._init_face_recognition_async)

    def _init_face_recognition_async(self):
        if inicializar_sistema_facial is None:
            _lazy_load_face_recognition()
        if FACE_RECOGNITION_AVAILABLE and inicializar_sistema_facial:
            try:
                self._set_status("Registrando fotos...", "warning")
                QApplication.processEvents()
                try:
                    from utils.register_photos import register_photos_from_database
                    register_photos_from_database()
                except Exception as e:
                    logger.warning(f"Error registrando fotos: {e}")
                self._set_status("Inicializando modelos...", "warning")
                QApplication.processEvents()
                result = inicializar_sistema_facial()
                if result:
                    self._set_status("Sistema listo", "success")
                else:
                    self._set_status("Sistema parcialmente listo", "warning")
            except Exception as e:
                logger.error(f"Error init reconocimiento: {e}", exc_info=True)
                self._set_status("Error en reconocimiento", "danger")
        else:
            self._set_status("Reconocimiento no disponible", "warning")

    # ------------------------------------------------------------------
    # Attendance
    # ------------------------------------------------------------------

    def auto_register_attendance_with_model(self, info_empleado: Dict, confianza: float):
        if self.attendance_registered:
            return
        try:
            eid = info_empleado.get('employee_id', 0)
            db = get_db_session()
            trab = None
            try:
                trab = db.query(Trabajador).filter(Trabajador.employee_id == eid).first()
                if not trab:
                    parts = info_empleado.get('nombre', '').split()
                    nombre = parts[0] if parts else 'Empleado'
                    apellido = ' '.join(parts[1:]) if len(parts) > 1 else 'Desconocido'
                    trab = Trabajador(
                        usuario=f"empleado_{eid}", password_hash="",
                        nombre=nombre, apellido=apellido,
                        sucursal=info_empleado.get('sucursal', 'N/A'),
                        zona=info_empleado.get('zona', 'N/A'),
                        puesto=info_empleado.get('puesto', 'N/A'),
                        employee_id=eid, activo=True
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
                tid = trabajador.id if hasattr(trabajador, 'id') and trabajador.id else None
                ultimo = None
                if tid:
                    ultimo = db.query(RegistroAsistencia).filter(
                        RegistroAsistencia.trabajador_id == tid,
                        func.date(RegistroAsistencia.timestamp) == hoy
                    ).order_by(RegistroAsistencia.timestamp.desc()).first()
                tipo = "salida" if ultimo and ultimo.tipo == "entrada" else "entrada"
                reg = RegistroAsistencia(
                    trabajador_id=tid, timestamp=datetime.now(), tipo=tipo,
                    reconocimiento_facial=True, confianza=confianza,
                    ubicacion=info_empleado.get('sucursal', 'N/A') if info_empleado else 'N/A'
                )
                db.add(reg)
                db.commit()
                self.attendance_registered = True
                nombre = info_empleado.get('nombre', 'Trabajador') if info_empleado else 'Trabajador'
                dlg = AttendanceDialog(
                    tipo, nombre,
                    f"{confianza*100:.0f}",
                    datetime.now().strftime('%H:%M:%S'),
                    parent=self
                )
                dlg.show()

                # --- INTEGRACIÓN SUPABASE ---
                try:
                    sb = get_supabase_client()
                    if sb:
                        # Buscamos el ID único del empleado en Supabase usando su employee_id único
                        emp_data = sb.table("empleados").select("id").eq("employee_id", trabajador.employee_id).execute()
                        if emp_data.data:
                            supabase_emp_id = emp_data.data[0]['id']
                            sb.table("asistencias").insert({
                                "empleado_id": supabase_emp_id,
                                "tipo": tipo,
                                "confianza": float(confianza),
                                "ubicacion": info_empleado.get('sucursal', 'N/A') if info_empleado else 'N/A'
                            }).execute()
                            logger.info(f"✅ Asistencia sincronizada con Supabase para {trabajador.nombre}")
                except Exception as es:
                    logger.error(f"❌ Error sincronizando con Supabase: {es}")
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
            QMessageBox.warning(self, "Error", "No hay imagen de camara. Activa la camara primero.")
            return
        if reconocer_desde_frame is None:
            _lazy_load_face_recognition()
        if not FACE_RECOGNITION_AVAILABLE or reconocer_desde_frame is None:
            QMessageBox.warning(self, "Error", "Sistema de reconocimiento no disponible.")
            return
        reconocido, confianza, idx = reconocer_desde_frame(
            self.current_frame, trabajador_id=self.trabajador.id,
            embedding_idx=self.trabajador.embedding_idx
        )
        if not reconocido or confianza < 0.85:
            QMessageBox.warning(self, "Reconocimiento Fallido",
                f"No se pudo reconocer al trabajador.\n"
                f"Confianza: {confianza*100:.1f}%\n\n"
                "Asegurate de estar bien iluminado y mirar a la camara.")
            return
        db = get_db_session()
        try:
            today = datetime.now().date()
            last = db.query(RegistroAsistencia).filter(
                RegistroAsistencia.trabajador_id == self.trabajador.id,
                RegistroAsistencia.timestamp >= datetime.combine(today, datetime.min.time())
            ).order_by(RegistroAsistencia.timestamp.desc()).first()
            tipo = 'salida' if last and last.tipo == 'entrada' else 'entrada'
            reg = RegistroAsistencia(
                trabajador_id=self.trabajador.id, tipo=tipo,
                reconocimiento_facial=True, confianza=confianza,
                ubicacion=self.trabajador.sucursal or "N/A"
            )
            db.add(reg)
            db.commit()
            self.attendance_registered = True
            nombre = f"{self.trabajador.nombre} {self.trabajador.apellido}"
            dlg = AttendanceDialog(
                tipo, nombre,
                f"{confianza*100:.0f}",
                datetime.now().strftime('%H:%M:%S'),
                parent=self
            )
            dlg.show()
            self._set_status(f"{tipo.upper()} registrada", "success")

            # --- INTEGRACIÓN SUPABASE ---
            try:
                sb = get_supabase_client()
                if sb:
                    emp_data = sb.table("empleados").select("id").eq("employee_id", self.trabajador.employee_id).execute()
                    if emp_data.data:
                        supabase_emp_id = emp_data.data[0]['id']
                        sb.table("asistencias").insert({
                            "empleado_id": supabase_emp_id,
                            "tipo": tipo,
                            "confianza": float(confianza),
                            "ubicacion": self.trabajador.sucursal or "N/A"
                        }).execute()
                        logger.info(f"✅ Asistencia manual sincronizada con Supabase")
            except Exception as es:
                logger.error(f"❌ Error sincronizando manual con Supabase: {es}")
            # ----------------------------
        except Exception as e:
            db.rollback()
            QMessageBox.critical(self, "Error", f"Error al registrar:\n{e}")
        finally:
            db.close()

    def logout(self):
        self.stop_camera()
        self.close()
        from windows.login_window import LoginWindow
        login_window = LoginWindow()
        login_window.show()

    def closeEvent(self, event):
        self.stop_camera()
        if hasattr(self, 'recognition_thread'):
            self.recognition_thread.stop()
        event.accept()
