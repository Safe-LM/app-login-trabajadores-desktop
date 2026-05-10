"""
DashboardWindow — Safe Link Monitoring Station v5.0 (NATIVE PYQT5)

Zero WebEngine. Zero React. Zero JavaScript bridge.
QWidgets nativos + QPainter HUD + servicios en background.
"""

import base64
import logging
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QSizePolicy,
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, QPropertyAnimation, QEasingCurve
from PyQt5.QtGui import (
    QImage, QPixmap, QFont, QColor, QPainter, QLinearGradient, QBrush,
)

from utils.design_tokens import SHARED, TOKENS, glass_surface
from ui.widgets.confidence_ring import ConfidenceRing
from ui.widgets.status_badge import StatusBadge
from ui.widgets.info_row import InfoRow
from ui.widgets.health_bar import HealthBar
from ui.widgets.activity_list import ActivityList
from ui.widgets.notification_overlay import NotificationOverlay
from ui.widgets.avatar_circle import AvatarCircle
from ui.widgets.numpad import Numpad
from ui.dialogs.attendance_dialog import AttendanceDialog

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
#  Camera Thread
# ═════════════════════════════════════════════════════════════════════════════
class _CameraThread(QThread):
    frame_ready    = pyqtSignal(np.ndarray)
    camera_started = pyqtSignal(bool)

    def __init__(self, index: int = 0):
        super().__init__()
        self._running = False
        self._index   = index
        self._cap     = None

    def start_camera(self) -> None:
        self._running = True
        self.start()

    def run(self) -> None:
        try:
            self._cap = cv2.VideoCapture(self._index, cv2.CAP_DSHOW)
            if not self._cap.isOpened():
                self._cap = cv2.VideoCapture(self._index)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self.msleep(120)
            if not self._cap.isOpened():
                self.camera_started.emit(False)
                return
            ok, _ = self._cap.read()
            if not ok:
                self.msleep(200)
                ok, _ = self._cap.read()
                if not ok:
                    self.camera_started.emit(False)
                    return
            self.camera_started.emit(True)
            skip = 0
            while self._running and self._cap:
                ok, frame = self._cap.read()
                if ok:
                    frame = cv2.flip(frame, 1)
                    if skip % 2 == 0:
                        try:
                            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                            l, a, b = cv2.split(lab)
                            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4,4))
                            l = clahe.apply(l)
                            frame = cv2.cvtColor(cv2.merge([l,a,b]), cv2.COLOR_LAB2BGR)
                        except Exception:
                            pass
                    skip += 1
                    self.frame_ready.emit(frame)
                else:
                    self.msleep(100)
                self.msleep(33)
        except Exception as e:
            logger.error(f"CameraThread: {e}")
            self.camera_started.emit(False)
        finally:
            if self._cap:
                try: self._cap.release()
                except Exception: pass

    def stop(self) -> None:
        self._running = False
        if self._cap:
            try: self._cap.release()
            except Exception: pass
        self.wait(2000)


# ═════════════════════════════════════════════════════════════════════════════
#  Recognition Thread
# ═════════════════════════════════════════════════════════════════════════════
class _RecognitionThread(QThread):
    results_ready = pyqtSignal(bool, float, object, str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.running        = False
        self.current_frame  = None
        self.processing     = False
        self._frame_lock    = threading.Lock()
        self._last_proc     = 0.0
        self._interval      = 2.5
        self._disabled: set = set()
        self._errors: dict  = {}
        self._MAX_ERR       = 3

    def set_frame(self, frame) -> None:
        if self.processing:
            return
        if self._frame_lock.acquire(blocking=False):
            try:
                self.current_frame = frame.copy() if frame is not None else None
            finally:
                self._frame_lock.release()

    def stop(self) -> None:
        self.running = False
        self.processing = False
        self.wait(2000)

    def run(self) -> None:
        import time as _t
        self.running = True
        while self.running:
            if self.current_frame is not None and not self.processing:
                t = _t.time()
                if t - self._last_proc >= self._interval:
                    self._last_proc = t
                    self.processing = True
                    try:
                        with self._frame_lock:
                            f = self.current_frame.copy() if self.current_frame is not None else None
                        if f is not None:
                            self._process(f)
                    except Exception as e:
                        msg = str(e)
                        if "1114" in msg or "DLL" in msg:
                            self._interval = min(self._interval + 0.5, 5.0)
                        else:
                            logger.error(f"RecognitionThread: {msg[:120]}")
                    finally:
                        self.processing = False
            self.msleep(300)

    def _record_error(self, method: str, error: Exception) -> None:
        count = self._errors.get(method, 0) + 1
        self._errors[method] = count
        msg = str(error)
        if any(s in msg for s in ("1114","DLL","WinError")) or count >= self._MAX_ERR:
            self._disabled.add(method)
            logger.warning(f"'{method}' deshabilitado: {type(error).__name__}")

    def _process(self, frame) -> None:
        h, w = frame.shape[:2]
        mx = 480
        if h > mx or w > mx:
            s = min(mx/h, mx/w)
            frame = cv2.resize(frame, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)

        if "hybrid" not in self._disabled:
            try:
                from utils.hybrid_opencv_gemini_matcher import match_photo_hybrid
                ok, conf, info, method = match_photo_hybrid(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._errors.pop("hybrid", None)
                    self.results_ready.emit(True, conf, info, method)
                    return
            except Exception as e:
                self._record_error("hybrid", e)

        if "photo_matcher" not in self._disabled:
            try:
                from utils.photo_to_photo_matcher import match_photo_from_frame
                ok, conf, info = match_photo_from_frame(frame, min_confidence=0.80)
                if ok and info and conf >= 0.80:
                    self._errors.pop("photo_matcher", None)
                    self.results_ready.emit(True, conf, info, "Foto")
                    return
            except Exception as e:
                self._record_error("photo_matcher", e)

        if "opencv" not in self._disabled:
            try:
                from utils.face_recognition_opencv import recognize_opencv
                ok, conf, info = recognize_opencv(frame)
                if ok and info:
                    self._errors.pop("opencv", None)
                    self.results_ready.emit(True, conf, info, "OpenCV")
                    return
            except Exception as e:
                self._record_error("opencv", e)

# ═════════════════════════════════════════════════════════════════════════════
#  DashboardWindow — NATIVE PYQT5
# ═════════════════════════════════════════════════════════════════════════════
class DashboardWindow(QMainWindow):

    def __init__(self, trabajador=None):
        super().__init__()
        self.trabajador = trabajador

        self._cam_thread: Optional[_CameraThread] = None
        self._rec_thread: Optional[_RecognitionThread] = None
        self._current_frame: Optional[np.ndarray] = None
        self._attendance_done = False
        self._active_dialog = False
        self._last_rec_ts = 0.0
        self._prep_count = 0
        self._prep_timer: Optional[QTimer] = None
        self._last_frame_ts = 0.0
        self._had_face = False
        self._last_avatar_b64 = ""
        self._last_info: Optional[dict] = None
        self._sync_mgr = None

        self._init_ui()
        self._init_services()

    # ── UI Construction ─────────────────────────────────────────────────────

    def _init_ui(self) -> None:
        self.setWindowTitle("Safe Link Monitoring — Estacion de Acceso")
        self.setMinimumSize(1080, 640)
        self.resize(1280, 760)
        self.setStyleSheet(f"QMainWindow{{background:{SHARED['bg_dark']};}}")

        root = QWidget()
        self.setCentralWidget(root)
        root_lay = QVBoxLayout(root)
        root_lay.setSpacing(0)
        root_lay.setContentsMargins(0, 0, 0, 0)

        root_lay.addWidget(self._build_header())
        root_lay.addWidget(self._build_body())

        self._notification = NotificationOverlay(self)

    def _build_header(self) -> QFrame:
        header = QFrame()
        header.setFixedHeight(TOKENS["header_height"])
        header.setStyleSheet(
            f"background:{SHARED['bg_dark']};border-bottom:1px solid {SHARED['border']};"
        )
        h_lay = QHBoxLayout(header)
        h_lay.setContentsMargins(TOKENS["spacing_xl"], 0, TOKENS["spacing_xl"], 0)

        brand = QLabel("SAFE LINK")
        brand.setFont(QFont(SHARED["font_ui"], TOKENS["font_lg"], QFont.Bold))
        brand.setStyleSheet(f"color:{SHARED['accent']};background:transparent;")
        h_lay.addWidget(brand)

        sep = QLabel("|")
        sep.setStyleSheet(f"color:{SHARED['border']};background:transparent;font-size:16px;")
        h_lay.addWidget(sep)

        self._station_lbl = QLabel("Estacion")
        self._station_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        self._station_lbl.setStyleSheet(f"color:{SHARED['text_dim']};background:transparent;")
        h_lay.addWidget(self._station_lbl)
        h_lay.addStretch()

        self._conn_dot = QLabel()
        self._conn_dot.setFixedSize(8, 8)
        self._conn_dot.setStyleSheet(f"background:{SHARED['success']};border-radius:4px;")
        h_lay.addWidget(self._conn_dot)

        self._conn_lbl = QLabel("En Linea")
        self._conn_lbl.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"], QFont.Bold))
        self._conn_lbl.setStyleSheet(
            f"color:{SHARED['success']};background:transparent;letter-spacing:1px;margin-left:4px;"
        )
        h_lay.addWidget(self._conn_lbl)

        sep2 = QLabel("|")
        sep2.setStyleSheet(f"color:{SHARED['border']};background:transparent;font-size:14px;margin:0 8px;")
        h_lay.addWidget(sep2)

        self._clock_lbl = QLabel()
        self._clock_lbl.setFont(QFont(SHARED["font_mono"], TOKENS["font_md"]))
        self._clock_lbl.setStyleSheet(f"color:{SHARED['text_dim']};background:transparent;")
        h_lay.addWidget(self._clock_lbl)

        self._clock_timer = QTimer(self)
        self._clock_timer.timeout.connect(self._update_clock)
        self._clock_timer.start(1000)
        self._update_clock()

        return header

    def _build_body(self) -> QWidget:
        body = QWidget()
        body.setStyleSheet(f"background:{SHARED['bg_dark']};")
        b_lay = QHBoxLayout(body)
        b_lay.setSpacing(TOKENS["spacing_md"])
        b_lay.setContentsMargins(
            TOKENS["spacing_lg"], TOKENS["spacing_md"],
            TOKENS["spacing_lg"], TOKENS["spacing_md"],
        )

        b_lay.addWidget(self._build_camera_card(), 3)
        b_lay.addWidget(self._build_info_panel(), 0)
        return body

    def _build_camera_card(self) -> QFrame:
        card = QFrame()
        card.setStyleSheet(glass_surface())
        card.setMinimumWidth(TOKENS["camera_min_width"])

        lay = QVBoxLayout(card)
        lay.setContentsMargins(TOKENS["spacing_lg"], TOKENS["spacing_lg"],
                               TOKENS["spacing_lg"], TOKENS["spacing_lg"])
        lay.setSpacing(TOKENS["spacing_md"])

        cam_header = QHBoxLayout()
        cam_title = QLabel("Camara en vivo")
        cam_title.setFont(QFont(SHARED["font_ui"], TOKENS["font_lg"], QFont.Bold))
        cam_title.setStyleSheet(f"color:{SHARED['text_primary']};background:transparent;")
        cam_header.addWidget(cam_title)
        cam_header.addStretch()
        self._camera_badge = StatusBadge()
        cam_header.addWidget(self._camera_badge)
        lay.addLayout(cam_header)

        self._video_label = QLabel("Preparando camara...")
        self._video_label.setAlignment(Qt.AlignCenter)
        self._video_label.setMinimumHeight(TOKENS["camera_min_height"])
        self._video_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self._video_label.setStyleSheet(
            f"background:#000;border:1px solid {SHARED['border']};"
            f"border-radius:{TOKENS['radius_lg']}px;color:{SHARED['text_muted']};"
            f"font-size:{TOKENS['font_lg']}px;"
        )
        lay.addWidget(self._video_label)
        return card

    def _build_info_panel(self) -> QFrame:
        card = QFrame()
        card.setStyleSheet(glass_surface())
        card.setFixedWidth(TOKENS["info_panel_width"])

        lay = QVBoxLayout(card)
        lay.setContentsMargins(TOKENS["spacing_lg"], TOKENS["spacing_lg"],
                               TOKENS["spacing_lg"], TOKENS["spacing_lg"])
        lay.setSpacing(TOKENS["spacing_md"])

        # Status Hero
        status_hero = QFrame()
        status_hero.setObjectName("statusHero")
        status_hero.setStyleSheet(
            f"QFrame#statusHero{{"
            f"background:qlineargradient(x1:0,y1:0,x2:1,y2:1,"
            f"stop:0 rgba(0,210,255,0.10),stop:1 rgba(58,134,255,0.05));"
            f"border:1px solid rgba(0,210,255,0.20);"
            f"border-radius:{TOKENS['radius_xl']}px;}}"
        )
        sh_lay = QVBoxLayout(status_hero)
        sh_lay.setContentsMargins(16, TOKENS["spacing_xl"], 16, TOKENS["spacing_xl"])
        sh_lay.setSpacing(TOKENS["spacing_xs"])

        self._status_title = QLabel("MODO ESCANEO")
        self._status_title.setAlignment(Qt.AlignCenter)
        self._status_title.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"], QFont.Bold))
        self._status_title.setStyleSheet(
            f"color:{SHARED['accent']};background:transparent;letter-spacing:2.5px;"
        )
        sh_lay.addWidget(self._status_title)

        self._confidence_ring = ConfidenceRing(size=130)
        sh_lay.addWidget(self._confidence_ring, 0, Qt.AlignCenter)

        conf_hint = QLabel("CONFIANZA")
        conf_hint.setAlignment(Qt.AlignCenter)
        conf_hint.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"] - 1, QFont.Bold))
        conf_hint.setStyleSheet(
            f"color:{SHARED['text_muted']};background:transparent;letter-spacing:3px;"
        )
        sh_lay.addWidget(conf_hint)
        lay.addWidget(status_hero)

        # Avatar
        self._avatar = AvatarCircle(size=120)
        lay.addWidget(self._avatar, 0, Qt.AlignCenter)

        # Info Grid
        info_grid = QFrame()
        info_grid.setStyleSheet(
            f"background:{SHARED['bg_surface']};"
            f"border:1px solid {SHARED['border']};"
            f"border-radius:{TOKENS['radius_lg']}px;"
        )
        ig_lay = QVBoxLayout(info_grid)
        ig_lay.setContentsMargins(TOKENS["spacing_md"], TOKENS["spacing_md"],
                                  TOKENS["spacing_md"], TOKENS["spacing_md"])
        ig_lay.setSpacing(TOKENS["spacing_xs"])

        self._info_name = InfoRow("NOMBRE", accent_color=SHARED["accent"])
        self._info_apellido = InfoRow("APELLIDOS", accent_color="#58a6ff")
        self._info_zona = InfoRow("ZONA", accent_color=SHARED["warning"])
        self._info_sucursal = InfoRow("SUCURSAL", accent_color=SHARED["success"])
        self._info_puesto = InfoRow("PUESTO", accent_color="#bc8cff")
        for w in (self._info_name, self._info_apellido, self._info_zona,
                  self._info_sucursal, self._info_puesto):
            ig_lay.addWidget(w)
        lay.addWidget(info_grid)

        # Last registration
        self._last_reg_lbl = QLabel("Sin registros hoy")
        self._last_reg_lbl.setAlignment(Qt.AlignCenter)
        self._last_reg_lbl.setFont(QFont(SHARED["font_mono"], TOKENS["font_sm"]))
        self._last_reg_lbl.setStyleSheet(
            f"color:{SHARED['text_dim']};background:{SHARED['bg_surface']};"
            f"border:1px solid {SHARED['border']};border-radius:{TOKENS['radius_md']}px;"
            f"padding:6px;"
        )
        lay.addWidget(self._last_reg_lbl)

        # Activity list
        self._activity_list = ActivityList()
        lay.addWidget(self._activity_list)

        # Health bar
        self._health_bar = HealthBar()
        lay.addWidget(self._health_bar)

        # Supervisor button
        supervisor_btn = QPushButton("Panel de Supervisor")
        supervisor_btn.setCursor(Qt.PointingHandCursor)
        supervisor_btn.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        supervisor_btn.setStyleSheet(
            f"QPushButton{{"
            f"background:{SHARED['bg_surface_hover']};color:{SHARED['text_primary']};"
            f"border:1px solid {SHARED['border']};"
            f"border-radius:{TOKENS['radius_xl']}px;padding:14px 20px;"
            f"}}"
            f"QPushButton:hover{{background:rgba(255,255,255,0.08);}}"
        )
        supervisor_btn.clicked.connect(self._open_supervisor)
        lay.addWidget(supervisor_btn)

        return card

    # ── Services Init ───────────────────────────────────────────────────────

    def _init_services(self) -> None:
        QTimer.singleShot(500, self._load_last_registration)
        QTimer.singleShot(1000, self._start_camera)
        QTimer.singleShot(2500, self._start_sync_manager)
        QTimer.singleShot(3500, self._start_command_polling)
        QTimer.singleShot(5000, self._init_face_recognition)

    # ── Clock ───────────────────────────────────────────────────────────────

    def _update_clock(self) -> None:
        from datetime import datetime
        now = datetime.now()
        self._clock_lbl.setText(now.strftime("%H:%M:%S"))

    # ── Camera ──────────────────────────────────────────────────────────────

    def _start_camera(self) -> None:
        if self._cam_thread:
            return
        self._set_status("Conectando camara...", "warning")
        self._camera_badge.set_warning("CONECTANDO")
        self._cam_thread = _CameraThread(0)
        self._cam_thread.frame_ready.connect(self._on_frame)
        self._cam_thread.camera_started.connect(self._on_cam_started)
        QTimer.singleShot(50, self._cam_thread.start_camera)

    def _on_cam_started(self, ok: bool) -> None:
        try:
            from utils.station_manager import report_health
            report_health(camara_ok=ok)
        except Exception:
            pass
        if not ok:
            self._cam_thread = None
            self._camera_badge.set_offline("ERROR")
            self._set_status("Error de camara", "danger")
            return
        self._prep_count = 5
        self._prep_timer = QTimer(self)
        self._prep_timer.setInterval(1000)
        self._prep_timer.timeout.connect(self._prep_tick)
        self._prep_timer.start()
        self._prep_tick()

    def _prep_tick(self) -> None:
        if self._prep_count > 0:
            self._camera_badge.set_warning(f"ESPERA {self._prep_count}S")
            self._set_status(f"Acomodate frente a la camara... {self._prep_count}s", "warning")
            self._prep_count -= 1
        else:
            self._prep_timer.stop()
            self._camera_badge.set_online("EN VIVO", SHARED["success"])
            self._set_status("Buscando rostro...", "warning")
            if self._rec_thread and not self._rec_thread.isRunning():
                self._rec_thread.start()

    def _stop_camera(self) -> None:
        if self._cam_thread:
            self._cam_thread.stop()
            self._cam_thread = None
        self._camera_badge.set_offline()
        self._camera_badge.hide_dot()
        self._set_status("Sistema listo", "neutral")
        self._current_frame = None
        self._video_label.clear()
        self._video_label.setText("Camara detenida")
        self._confidence_ring.reset()

    # ── Frame handling + QPainter HUD ───────────────────────────────────────

    def _on_frame(self, frame: np.ndarray) -> None:
        if frame is None or frame.size == 0:
            return
        self._current_frame = frame
        now = time.time()
        if now - self._last_frame_ts < 0.05:
            return
        self._last_frame_ts = now
        self._update_video_display(frame)
        if self._rec_thread and self._rec_thread.isRunning() and not self._rec_thread.processing:
            if time.time() - self._last_rec_ts >= 0.5:
                self._last_rec_ts = time.time()
                self._rec_thread.set_frame(frame)

    def _update_video_display(self, frame: np.ndarray) -> None:
        lbl = self._video_label
        tw, th = lbl.width() - 4, lbl.height() - 4
        if tw < 10 or th < 10:
            return
        h, w = frame.shape[:2]
        s = min(tw / w, th / h)
        nw, nh = int(w * s), int(h * s)
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        rgb = np.ascontiguousarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))
        # .copy() fuerza a QImage a poseer su propio buffer — sin esto, el
        # ndarray puede liberarse antes de que Qt pinte (visible en builds
        # PyInstaller como bandas horizontales en el video).
        qimg = QImage(rgb.data, nw, nh, 3 * nw, QImage.Format_RGB888).copy()

        # QPainter HUD overlay
        painter = QPainter(qimg)
        painter.setRenderHint(QPainter.Antialiasing)
        p_color = QColor(
            SHARED["accent"] if not self._attendance_done else SHARED["success"]
        )
        p_color.setAlpha(180)
        pen = painter.pen()
        pen.setColor(p_color)
        pen.setWidth(2)
        painter.setPen(pen)

        m = 36
        L = 28
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

        # Scan line
        if not self._attendance_done:
            ty = int((time.time() * 150) % (nh - 2 * m)) + m
            laser_grad = QLinearGradient(m, ty, nw - m, ty)
            laser_grad.setColorAt(0, QColor(0, 0, 0, 0))
            laser_grad.setColorAt(0.5, p_color)
            laser_grad.setColorAt(1, QColor(0, 0, 0, 0))
            painter.fillRect(m, ty, nw - 2 * m, 2, QBrush(laser_grad))
        painter.end()

        if lbl.text():
            lbl.setText("")
            lbl.setStyleSheet(
                f"border-radius:{TOKENS['radius_lg']}px;background:#000;"
                f"border:1px solid {SHARED['border']};"
            )
        lbl.setPixmap(QPixmap.fromImage(qimg))

    # ── Recognition ─────────────────────────────────────────────────────────

    def _init_face_recognition(self) -> None:
        self._set_status("Inicializando reconocimiento...", "warning")
        self._rec_thread = _RecognitionThread(self)
        self._rec_thread.results_ready.connect(self._on_recognition)

        import threading as _th
        def _bg_init() -> None:
            try:
                try:
                    from utils.register_photos import register_photos_from_database
                    register_photos_from_database()
                except Exception:
                    pass
                QTimer.singleShot(0, lambda: self._set_status("Sistema listo", "neutral"))
            except Exception as e:
                logger.error(f"init facial: {e}")
                QTimer.singleShot(0, lambda: self._set_status("Reconocimiento parcial", "warning"))
        _th.Thread(target=_bg_init, daemon=True).start()

    def _on_recognition(self, ok: bool, conf: float, info: dict, method: str) -> None:
        if ok and info:
            self._had_face = True
            self._last_info = info
            pct = conf * 100
            arc_color = (
                SHARED["success"] if pct >= 80 else
                SHARED["warning"] if pct >= 60 else SHARED["danger"]
            )
            self._confidence_ring.set_value(pct, arc_color)
            self._set_status(f"Identificado — {method}", "success")

            self._info_name.set_value(info.get("nombre", "N/A"))
            self._info_apellido.set_value(info.get("apellido", ""))
            self._info_zona.set_value(info.get("zona", "N/A"))
            self._info_sucursal.set_value(info.get("sucursal", "N/A"))
            self._info_puesto.set_value(info.get("puesto", "N/A"))

            self._load_employee_photo(info)
            if conf >= 0.85 and not self._attendance_done:
                self._auto_register(info, conf, method)
        else:
            if time.time() - self._last_rec_ts > 3.0:
                self._set_status("Buscando rostro...", "warning")
                self._reset_info_panel()
                if self._had_face:
                    self._notification.show_not_recognized()
                    self._had_face = False
                    self._last_avatar_b64 = ""
                    self._last_info = None

    def _load_employee_photo(self, info: dict) -> None:
        try:
            from utils.employee_mapper import get_photo_path
            eid = info.get("employee_id", 0)
            photo_path = get_photo_path(eid)
            if photo_path and Path(photo_path).exists():
                px = QPixmap(str(photo_path))
                if not px.isNull():
                    from PyQt5.QtCore import QByteArray, QBuffer
                    ba = QByteArray()
                    buf2 = QBuffer(ba)
                    buf2.open(QBuffer.WriteOnly)
                    px.save(buf2, "JPEG", 80)
                    self._last_avatar_b64 = base64.b64encode(ba.data()).decode()
                    nombre = f"{info.get('nombre','')} {info.get('apellido','')}".strip()
                    self._avatar.set_photo(px, nombre)
                    return
        except Exception:
            self._last_avatar_b64 = ""
        self._avatar.set_photo(None)

    def _reset_info_panel(self) -> None:
        self._confidence_ring.reset()
        self._info_name.set_value("--")
        self._info_apellido.set_value("--")
        self._info_zona.set_value("--")
        self._info_sucursal.set_value("--")
        self._info_puesto.set_value("--")
        self._avatar.reset()

    # ── Attendance ──────────────────────────────────────────────────────────

    def _auto_register(self, info: dict, conf: float, method: str) -> None:
        if self._attendance_done or self._active_dialog:
            return
        try:
            from services.attendance_service import (
                register_local, is_in_cooldown,
            )
            from services.dto import RecognitionResult

            eid = info.get("employee_id", 0)
            result = RecognitionResult(
                recognized=True, confidence=conf,
                employee_id=eid, nombre=info.get("nombre", ""),
                apellido=info.get("apellido", ""),
                zona=info.get("zona", "N/A"),
                sucursal=info.get("sucursal", "N/A"),
                puesto=info.get("puesto", "N/A"),
                method=method, avatar_b64=self._last_avatar_b64,
            )

            # Cooldown check
            record = register_local(result)
            blocked, block_info = is_in_cooldown(record.trabajador_id)
            if blocked and block_info:
                self._notification.show_already_registered(
                    block_info["tipo"], block_info["hora"],
                )
                return

            self._active_dialog = True
            self._attendance_done = True
            nombre_display = f"{result.nombre} {result.apellido}".strip()
            hora = record.timestamp.strftime("%H:%M:%S")

            # Show dialog
            dlg = AttendanceDialog(
                record.tipo, nombre_display or "Empleado",
                conf * 100, hora, "", self,
            )
            dlg.show()

            # Cloud sync
            import threading as _th
            def _sync() -> None:
                from services.attendance_service import sync_to_supabase
                ok_cloud = sync_to_supabase(record)
                msg = "Registro en nube" if ok_cloud else "Registro local (sin conexion)"
                status_type = "success" if ok_cloud else "warning"
                QTimer.singleShot(0, lambda: self._set_status(msg, status_type))
            _th.Thread(target=_sync, daemon=True).start()

            # Add to activity
            self._activity_list.add_record(
                nombre_display or "Empleado", record.tipo, hora,
            )
            self._update_last_reg(record.tipo, record.timestamp)

            # Flush offline queue
            QTimer.singleShot(2000, lambda: self._flush_offline_queue())
            QTimer.singleShot(6000, self._reset_after_attendance)
        except Exception as e:
            logger.error(f"auto_register: {e}")

    def _reset_after_attendance(self) -> None:
        self._attendance_done = False
        self._active_dialog = False
        self._had_face = False
        self._last_avatar_b64 = ""
        self._last_info = None
        self._camera_badge.set_online("EN VIVO", SHARED["success"])
        self._reset_info_panel()
        self._set_status("Buscando rostro...", "warning")

    # ── Status helpers ──────────────────────────────────────────────────────

    LEVEL_COLORS = {
        "success": (SHARED["success"], "rgba(16,185,129,0.15)", "rgba(16,185,129,0.30)"),
        "warning": (SHARED["warning"], "rgba(245,158,11,0.10)", "rgba(245,158,11,0.20)"),
        "danger": (SHARED["danger"], "rgba(239,68,68,0.10)", "rgba(239,68,68,0.20)"),
        "neutral": (SHARED["accent"], "rgba(0,210,255,0.10)", "rgba(0,210,255,0.20)"),
    }

    def _set_status(self, text: str, level: str = "neutral") -> None:
        fg, bg, bc = self.LEVEL_COLORS.get(level, self.LEVEL_COLORS["neutral"])
        self._status_title.setText(text.upper())
        self._status_title.setStyleSheet(
            f"color:{fg};background:transparent;letter-spacing:2.5px;"
        )
        if hasattr(self, "_status_hero"):
            pass

    # ── Last registration ──────────────────────────────────────────────────

    def _load_last_registration(self) -> None:
        try:
            from services.attendance_service import get_last_registration_text, get_recent_activity
            text = get_last_registration_text()
            if text:
                self._last_reg_lbl.setText(text)
            recs = get_recent_activity()
            self._activity_list.set_records(recs)
        except Exception:
            pass

    def _update_last_reg(self, tipo: str, ts) -> None:
        hora = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        self._last_reg_lbl.setText(f"{tipo.upper()}  {hora}")

    # ── Connectivity ────────────────────────────────────────────────────────

    def _on_heartbeat_status(self, state: str, msg: str) -> None:
        if state == "online":
            self._conn_dot.setStyleSheet(f"background:{SHARED['success']};border-radius:4px;")
            self._conn_lbl.setText("En Linea")
            self._conn_lbl.setStyleSheet(
                f"color:{SHARED['success']};background:transparent;letter-spacing:1px;margin-left:4px;"
            )
        elif state == "revocada":
            self._conn_dot.setStyleSheet(f"background:{SHARED['danger']};border-radius:4px;")
            self._conn_lbl.setText("Revocada")
            self._conn_lbl.setStyleSheet(
                f"color:{SHARED['danger']};background:transparent;letter-spacing:1px;margin-left:4px;"
            )
        else:
            self._conn_dot.setStyleSheet(f"background:{SHARED['text_muted']};border-radius:4px;")
            self._conn_lbl.setText("Offline")
            self._conn_lbl.setStyleSheet(
                f"color:{SHARED['text_muted']};background:transparent;letter-spacing:1px;margin-left:4px;"
            )
        self._push_health_to_ui()

    # ── Sync Manager ────────────────────────────────────────────────────────

    def _start_sync_manager(self) -> None:
        try:
            from utils.sync_manager import get_sync_manager
            self._sync_mgr = get_sync_manager()
            self._sync_mgr.sync_started.connect(
                lambda: self._set_status("Sincronizando empleados...", "warning")
            )
            self._sync_mgr.sync_done.connect(self._on_sync_done)
            self._sync_mgr.sync_error.connect(lambda msg: logger.warning(f"Sync error: {msg}"))
            self._sync_mgr.start()
        except Exception as e:
            logger.error(f"SyncManager init error: {e}")

    def _on_sync_done(self, count: int) -> None:
        logger.info(f"Sync completado: {count} empleados")
        self._set_status("Sistema listo", "neutral")
        try:
            cache_dir = self._sync_mgr.get_cache_dir()
            if cache_dir:
                self._reload_matchers_from_cache(cache_dir)
        except Exception:
            pass
        self._push_health_to_ui()

    def _reload_matchers_from_cache(self, cache_dir: str) -> None:
        try:
            import utils.hybrid_opencv_gemini_matcher as hm
            import utils.photo_to_photo_matcher as pm
            hm._hybrid_matcher = None
            pm._photo_matcher = None
            hm.get_hybrid_matcher(database_dir=cache_dir)
            pm.get_photo_matcher(database_dir=cache_dir)
        except Exception as e:
            logger.warning(f"reload matchers: {e}")

    # ── Command Listener (Realtime + polling fallback) ──────────────────────

    def _start_command_polling(self) -> None:
        """Realtime para comandos + polling como fallback (cada 2 min)."""
        from utils.station_manager import StationInfo
        dispositivo_id = StationInfo.dispositivo_id

        # Realtime: comandos llegan en <500ms vía WebSocket
        if dispositivo_id:
            try:
                from utils.realtime_listener import RealtimeCommandListener
                self._rt_listener = RealtimeCommandListener(
                    dispositivo_id=dispositivo_id,
                    on_command=self._on_realtime_command,
                )
                self._rt_listener.start()
            except Exception as e:
                logger.warning(f"Realtime listener falló: {e}")

        # Fallback polling cada 2 min (recoge lo que Realtime pueda perder)
        self._cmd_poll_timer = QTimer(self)
        self._cmd_poll_timer.setInterval(120_000)
        self._cmd_poll_timer.timeout.connect(self._poll_commands)
        self._cmd_poll_timer.start()
        QTimer.singleShot(800, self._poll_commands)
        logger.info("Listener de comandos iniciado (Realtime + polling fallback 2min)")

    def _on_realtime_command(self, cmd: dict) -> None:
        """Callback desde RealtimeListener (corre en thread del listener)."""
        from utils.station_manager import get_station_api_key
        from utils.supabase_client import get_supabase_client
        api_key = get_station_api_key()
        sb = get_supabase_client()
        if not api_key or not sb:
            return
        QTimer.singleShot(0, lambda: self._execute_command(cmd, api_key, sb))

    def _poll_commands(self) -> None:
        if getattr(self, "_polling", False):
            return
        self._polling = True

        def _bg() -> None:
            try:
                from utils.station_manager import StationInfo, get_station_api_key
                from utils.supabase_client import get_supabase_client
                dispositivo_id = StationInfo.dispositivo_id
                api_key = get_station_api_key()
                if not dispositivo_id or not api_key:
                    return
                sb = get_supabase_client()
                if not sb:
                    return
                result = (
                    sb.table("comandos_estacion")
                    .select("id, tipo, payload")
                    .eq("dispositivo_id", str(dispositivo_id))
                    .is_("ejecutado_en", "null")
                    .order("creado_en")
                    .limit(10)
                    .execute()
                )
                cmds = result.data or []
                if cmds:
                    QTimer.singleShot(0, lambda: [self._execute_command(c, api_key, sb) for c in cmds])
            except Exception as e:
                logger.debug(f"Poll commands error: {e}")
            finally:
                self._polling = False
        import threading as _th
        _th.Thread(target=_bg, daemon=True).start()

    def _execute_command(self, cmd: dict, api_key: str, sb) -> None:
        tipo = cmd.get("tipo", "")
        cmd_id = cmd.get("id", "")

        # Deduplicación: evita doble ejecución cuando Realtime y polling reciben el mismo cmd
        if cmd_id:
            if not hasattr(self, "_seen_cmds"):
                self._seen_cmds = set()
            if cmd_id in self._seen_cmds:
                return
            self._seen_cmds.add(cmd_id)

        resultado = "ok"
        cmd_short = cmd_id[:8] if cmd_id else "?"
        try:
            if tipo == "sync_empleados":
                logger.info(f"Comando recibido: sync_empleados ({cmd_short})")
                if self._sync_mgr:
                    self._sync_mgr.force_sync()
            elif tipo == "reiniciar_app":
                logger.info(f"Comando recibido: reiniciar_app ({cmd_short})")
                QTimer.singleShot(1000, self._logout)
            elif tipo == "limpiar_cache":
                logger.info(f"Comando recibido: limpiar_cache ({cmd_short})")
            else:
                logger.warning(f"Comando desconocido: {tipo}")
                resultado = f"tipo desconocido: {tipo}"
        except Exception as ex:
            logger.error(f"execute_command {tipo}: {ex}")
            resultado = f"error: {ex}"

        # Confirmar SIEMPRE en Supabase para que el panel sepa que llegó
        if cmd_id:
            try:
                sb.rpc("marcar_comando_ejecutado", {
                    "p_api_key": api_key,
                    "p_comando_id": cmd_id,
                    "p_resultado": resultado,
                }).execute()
            except Exception as ex:
                logger.warning(f"No se pudo marcar cmd {cmd_short} como ejecutado: {ex}")

    # ── Offline Queue ───────────────────────────────────────────────────────

    def _flush_offline_queue(self) -> None:
        import threading as _th
        def _bg() -> None:
            try:
                from services.attendance_service import flush_offline_queue
                count = flush_offline_queue()
                if count:
                    logger.info(f"Offline queue flushed: {count}")
            except Exception as e:
                logger.error(f"flush_offline_queue: {e}")
        _th.Thread(target=_bg, daemon=True).start()

    # ── Health ──────────────────────────────────────────────────────────────

    def _push_health_to_ui(self) -> None:
        try:
            from utils.station_manager import (
                _health_empleados_count, _health_camara_ok, _health_encodings_ver,
            )
            score = 0
            if _health_camara_ok is True:
                score += 30
            if _health_empleados_count > 0:
                score += 40
            if _health_encodings_ver > 0:
                score += 30
            self._health_bar.update_health(
                score, _health_camara_ok,
                _health_empleados_count, _health_encodings_ver,
            )
        except Exception:
            pass

    # ── Supervisor Panel ────────────────────────────────────────────────────

    def _open_supervisor(self) -> None:
        self._supervisor_dialog = _SupervisorPanel(self._logout, self)
        self._supervisor_dialog.show()

    # ── Logout / Reset ──────────────────────────────────────────────────────

    def _logout(self) -> None:
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        self._attendance_done = False
        self._had_face = False
        self._last_avatar_b64 = ""
        self._last_info = None
        self._reset_info_panel()
        self._set_status("Sistema listo", "neutral")
        if not self._cam_thread:
            QTimer.singleShot(500, self._start_camera)

    # ── Show / Close ────────────────────────────────────────────────────────

    def showEvent(self, event) -> None:
        super().showEvent(event)
        self.setWindowOpacity(0)
        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(350)
        from PyQt5.QtCore import QEasingCurve
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.setEasingCurve(QEasingCurve.OutCubic)
        self._fade.start()

    def closeEvent(self, ev) -> None:
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        ev.accept()


# ═════════════════════════════════════════════════════════════════════════════
#  Supervisor Panel
# ═════════════════════════════════════════════════════════════════════════════
class _SupervisorPanel(QWidget):
    __slots__ = ("_logout_cb", "_numpad", "_unlocked", "_sync_btn")

    SUPERVISOR_PIN = "1234"

    def __init__(self, logout_callback, parent=None):
        super().__init__(
            parent, Qt.Window | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint,
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_DeleteOnClose)
        self._logout_cb = logout_callback
        self._unlocked = False

        if parent:
            self.setGeometry(parent.rect())

        self.setStyleSheet(f"background:{SHARED['bg_overlay']};")
        lay = QVBoxLayout(self)
        lay.setAlignment(Qt.AlignRight | Qt.AlignCenter)

        card = QFrame()
        card.setFixedWidth(380)
        card.setStyleSheet(
            f"background:{SHARED['bg_dark']};"
            f"border-left:1px solid {SHARED['border']};"
        )
        cl = QVBoxLayout(card)
        cl.setContentsMargins(TOKENS["spacing_2xl"], TOKENS["spacing_3xl"],
                              TOKENS["spacing_2xl"], TOKENS["spacing_2xl"])
        cl.setSpacing(TOKENS["spacing_xl"])

        # Header
        hdr = QHBoxLayout()
        shield = QLabel("S")
        shield.setFixedSize(36, 36)
        shield.setAlignment(Qt.AlignCenter)
        shield.setFont(QFont(SHARED["font_ui"], TOKENS["font_lg"], QFont.Bold))
        shield.setStyleSheet(
            f"background:rgba(37,99,235,0.12);border:1px solid rgba(37,99,235,0.25);"
            f"border-radius:{TOKENS['radius_md']}px;color:{SHARED['accent']};"
        )
        hdr.addWidget(shield)
        title_col = QVBoxLayout()
        title_col.setSpacing(0)
        t = QLabel("Panel Supervisor")
        t.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        t.setStyleSheet(f"color:{SHARED['text_primary']};background:transparent;")
        title_col.addWidget(t)
        sub = QLabel(self._get_station_name())
        sub.setFont(QFont(SHARED["font_ui"], TOKENS["font_sm"]))
        sub.setStyleSheet(
            f"color:{SHARED['text_muted']};background:transparent;letter-spacing:2px;"
        )
        title_col.addWidget(sub)
        hdr.addLayout(title_col)
        hdr.addStretch()
        cl.addLayout(hdr)

        # Divider
        div = QFrame()
        div.setFixedHeight(1)
        div.setStyleSheet(f"background:{SHARED['border']};")
        cl.addWidget(div)

        # Numpad area
        self._numpad = Numpad()
        self._numpad.pin_entered.connect(self._on_pin_correct)
        cl.addWidget(self._numpad)

        # Actions area (visible after unlock)
        self._actions = QFrame()
        self._actions.setStyleSheet("background:transparent;border:none;")
        self._actions.hide()
        al = QVBoxLayout(self._actions)
        al.setContentsMargins(0, 0, 0, 0)
        al.setSpacing(TOKENS["spacing_md"])

        section = QLabel("ACCIONES")
        section.setFont(QFont(SHARED["font_ui"], TOKENS["font_xs"], QFont.Bold))
        section.setStyleSheet(
            f"color:{SHARED['text_muted']};background:transparent;letter-spacing:2px;"
        )
        al.addWidget(section)

        self._sync_btn = QPushButton("Sincronizar empleados")
        self._sync_btn.setCursor(Qt.PointingHandCursor)
        self._sync_btn.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        self._sync_btn.setStyleSheet(
            f"QPushButton{{"
            f"background:rgba(37,99,235,0.08);color:white;"
            f"border:1px solid rgba(37,99,235,0.20);"
            f"border-radius:{TOKENS['radius_lg']}px;padding:12px 16px;"
            f"}}"
            f"QPushButton:hover{{background:rgba(37,99,235,0.18);}}"
        )
        self._sync_btn.clicked.connect(self._force_sync)
        al.addWidget(self._sync_btn)

        logout_btn = QPushButton("Cerrar sesion de estacion")
        logout_btn.setCursor(Qt.PointingHandCursor)
        logout_btn.setFont(QFont(SHARED["font_ui"], TOKENS["font_md"], QFont.Bold))
        logout_btn.setStyleSheet(
            f"QPushButton{{"
            f"background:rgba(239,68,68,0.06);color:{SHARED['danger']};"
            f"border:1px solid rgba(239,68,68,0.15);"
            f"border-radius:{TOKENS['radius_lg']}px;padding:12px 16px;"
            f"}}"
            f"QPushButton:hover{{background:rgba(239,68,68,0.14);}}"
        )
        logout_btn.clicked.connect(self._do_logout)
        al.addWidget(logout_btn)
        cl.addWidget(self._actions)
        lay.addWidget(card, 0, Qt.AlignRight)

    def _get_station_name(self) -> str:
        try:
            from utils.station_manager import StationInfo
            return StationInfo.nombre or "Estacion"
        except Exception:
            return "Estacion"

    def _on_pin_correct(self, pin: str) -> None:
        self._unlocked = True
        self._numpad.hide()
        self._actions.show()

    def _force_sync(self) -> None:
        self._sync_btn.setText("Sincronizando...")
        self._sync_btn.setEnabled(False)
        try:
            from utils.sync_manager import get_sync_manager
            mgr = get_sync_manager()
            mgr.force_sync()
        except Exception:
            pass
        QTimer.singleShot(1500, lambda: self._sync_btn.setText("Sincronizado ✓"))

    def _do_logout(self) -> None:
        self._logout_cb()
        self.close()

    def mousePressEvent(self, ev) -> None:
        if not self._unlocked:
            self.close()
        super().mousePressEvent(ev)
