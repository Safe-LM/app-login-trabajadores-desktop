"""
DashboardWindow — Safe Link Monitoring Station v4.0
UI: QWebEngineView + React (single-file bundle).
"""

import base64
import json
import logging
import socket
import threading
import time
from datetime import datetime

from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np
from PyQt5.QtCore import (
    QEasingCurve, QObject, QPropertyAnimation, QThread, QTimer, QUrl,
    Qt, pyqtSignal, pyqtSlot,
)
from PyQt5.QtGui import QIcon
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtWebEngineWidgets import QWebEngineSettings, QWebEngineView
from PyQt5.QtWidgets import (
    QMainWindow, QVBoxLayout, QWidget, QSystemTrayIcon, QMenu, QAction,
)

from utils.supabase_client import get_supabase_client
from windows.fallback_ui import _FALLBACK_HTML

logger = logging.getLogger(__name__)

FACE_RECOGNITION_AVAILABLE = False
reconocer_desde_frame = None
inicializar_sistema_facial = None


def _lazy_load_face_recognition():
    """Carga el motor de reconocimiento facial moderno (YuNet + SFace via
    OpenCV DNN). La estacion usa solo este motor desde v5.x — el modulo
    `face_recognition` legacy (dlib) fue removido pero el codigo aun
    intentaba importarlo y dejaba FACE_RECOGNITION_AVAILABLE=False
    permanentemente, lo que desactivaba TODO el reconocimiento en
    produccion aunque YuNet+SFace funcionara perfecto.

    Ahora apuntamos directamente a face_recognition_opencv y exponemos
    la API esperada por el resto del dashboard (reconocer_desde_frame,
    inicializar_sistema_facial)."""
    global FACE_RECOGNITION_AVAILABLE, reconocer_desde_frame, inicializar_sistema_facial
    if reconocer_desde_frame is not None:
        return
    try:
        from utils.face_recognition_opencv import (
            get_opencv_recognizer,
            recognize_opencv,
        )

        def _init() -> bool:
            """Forzar carga del singleton + encodings desde el cache de
            la empresa. Retorna True si quedo listo, False en caso
            contrario (ej. modelos DNN faltantes)."""
            try:
                rec = get_opencv_recognizer()
                if rec is None:
                    return False
                # load_encodings es idempotente y rapido si ya cargo
                if not rec.loaded:
                    rec.load_encodings()
                return rec._dnn_available
            except Exception as e:
                logger.warning(f"inicializar_sistema_facial: {e}")
                return False

        def _recognize(frame, trabajador_id=None, embedding_idx=None):
            """Wrapper compatible con la firma esperada por el dashboard.
            Los args trabajador_id/embedding_idx se aceptan por
            compatibilidad pero el motor moderno hace match global."""
            ok, conf, info = recognize_opencv(frame)
            return ok, conf, info

        reconocer_desde_frame = _recognize
        inicializar_sistema_facial = _init
        FACE_RECOGNITION_AVAILABLE = True
    except ImportError as e:
        logger.error(f"face_recognition_opencv no disponible: {e}")
        FACE_RECOGNITION_AVAILABLE = False
        reconocer_desde_frame = lambda *a, **k: (False, 0.0, None)
        inicializar_sistema_facial = lambda: False


# ─────────────────────────────────────────────────────────────────────────────
_SUPERVISOR_PIN = '1234'

# Fallback si no hay React build
_HTML = _FALLBACK_HTML


# ═════════════════════════════════════════════════════════════════════════════
#  Camera Thread
# ═════════════════════════════════════════════════════════════════════════════
class _CameraThread(QThread):
    frame_ready    = pyqtSignal(np.ndarray)
    camera_started = pyqtSignal(bool)

    def __init__(self, index=0):
        super().__init__()
        self._running = False
        self._index   = index
        self._cap     = None

    def start_camera(self):
        self._running = True
        self.start()

    def _open_capture(self):
        """Abre VideoCapture con DSHOW + fallback. Configura tamaño y buffer."""
        cap = cv2.VideoCapture(self._index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self._index)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)
        return cap

    def run(self):
        try:
            self._cap = self._open_capture()
            self.msleep(120)
            if not self._cap.isOpened():
                logger.error("CameraThread: no se pudo abrir la cámara")
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

            # A5: Watchdog de frames congelados. Si los ultimos N frames
            # tienen std<3 (uniformes/negros) o son identicos al previo
            # (cap.read devuelve buffer stuck), reabrimos la captura.
            # Sintomas tipicos en kioscos: USB se desconecta, lente
            # tapada, driver de Windows se cuelga.
            STUCK_THRESHOLD = 30   # ~1s a 30fps
            stuck_count = 0
            last_frame_hash = None

            skip = 0
            while self._running and self._cap:
                ok, frame = self._cap.read()
                if not ok:
                    self.msleep(100)
                    continue

                # Detectar frame congelado: std muy baja sostenida
                try:
                    gray_std = float(frame[..., 0].std())
                    # Hash rapido del frame para detectar buffer stuck
                    sample = bytes(frame[::40, ::40, 0])
                    is_uniform   = gray_std < 3
                    is_identical = last_frame_hash is not None and sample == last_frame_hash
                    last_frame_hash = sample

                    if is_uniform or is_identical:
                        stuck_count += 1
                    else:
                        stuck_count = 0

                    if stuck_count >= STUCK_THRESHOLD:
                        logger.warning(
                            f"CameraThread: detectados {stuck_count} frames "
                            f"congelados — reabriendo captura"
                        )
                        try:
                            self._cap.release()
                        except Exception:
                            pass
                        self.msleep(500)
                        self._cap = self._open_capture()
                        stuck_count = 0
                        last_frame_hash = None
                        continue
                except Exception:
                    pass

                # Espejo horizontal: usuario se ve como en un espejo
                # (UX estandar de kioscos). NO afecta al recognizer porque
                # SFace es invariante a horizontal flip.
                frame = cv2.flip(frame, 1)

                # CLAHE ADAPTATIVO: aplicamos solo si la imagen esta poco
                # iluminada (brillo medio <80). En condiciones normales NO
                # se aplica — la imagen llega cruda y nitida al usuario,
                # sin el filtro "lavado" que daba look brumoso.
                #
                # El recognizer en _process() tiene su propio path y no
                # depende de CLAHE: SFace tolera variaciones de iluminacion
                # razonables. Solo en escenarios oscuros activamos el
                # boost de contraste — donde si hace falta.
                try:
                    mean_brightness = float(frame[..., 0].mean())
                    if mean_brightness < 80 and skip % 3 == 0:
                        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                        l, a, b = cv2.split(lab)
                        # clipLimit reducido (1.2 vs 1.5) y aplicado solo
                        # cuando ES necesario — preview sigue nitido en
                        # condiciones normales de oficina.
                        clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
                        l = clahe.apply(l)
                        frame = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
                except Exception:
                    pass
                skip += 1

                # Frame pacing: descontar tiempo del processing para
                # mantener ~30fps reales en lugar de "30fps - latencia".
                import time as _t
                t0 = _t.time()
                self.frame_ready.emit(frame)
                elapsed_ms = (_t.time() - t0) * 1000.0
                sleep_ms = max(1, int(33 - elapsed_ms))
                self.msleep(sleep_ms)
        except Exception as e:
            logger.error(f"CameraThread: {e}")
            self.camera_started.emit(False)
        finally:
            if self._cap:
                try: self._cap.release()
                except Exception: pass

    def stop(self):
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
        self.running          = False
        self.current_frame    = None
        self.processing       = False
        self._frame_lock      = threading.Lock()
        self._last_proc       = 0.0
        self._interval        = 2.5
        self._disabled: set   = set()
        self._errors: dict    = {}
        self._MAX_ERR         = 3

    def set_frame(self, frame):
        if self.processing:
            return
        if self._frame_lock.acquire(blocking=False):
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
        logger.info("RecognitionThread: arrancado (interval=%.1fs)" % self._interval)
        self._log_panel("recognition_thread_started", interval=self._interval)
        attempts = 0
        while self.running:
            if self.current_frame is not None and not self.processing:
                t = time.time()
                if t - self._last_proc >= self._interval:
                    self._last_proc = t
                    self.processing = True
                    attempts += 1
                    self._current_attempt = attempts
                    try:
                        with self._frame_lock:
                            f = self.current_frame.copy() if self.current_frame is not None else None
                        if f is not None:
                            self._process(f)
                            if attempts <= 5 or attempts % 10 == 0:
                                logger.info(f"RecognitionThread: intento #{attempts} procesado")
                    except Exception as e:
                        msg = str(e)
                        if "1114" in msg or "DLL" in msg:
                            self._interval = min(self._interval + 0.5, 5.0)
                        else:
                            logger.error(f"RecognitionThread: {msg[:120]}")
                        self._log_panel("recognition_error", attempt=attempts, error=msg[:200])
                    finally:
                        self.processing = False
            self.msleep(300)
        logger.info("RecognitionThread: detenido")
        self._log_panel("recognition_thread_stopped", total_attempts=attempts)

    def _log_panel(self, tipo: str, **detalle):
        """Best-effort: sube un evento al panel para debug remoto. No bloquea
        ni rompe el flujo de reconocimiento si falla."""
        import threading
        def _bg():
            try:
                from utils.station_manager import get_station_api_key
                from utils.supabase_client import get_supabase_client
                api_key = get_station_api_key()
                sb = get_supabase_client()
                if not api_key or not sb:
                    return
                sb.rpc("insertar_log_estacion", {
                    "p_api_key": api_key,
                    "p_tipo": tipo,
                    "p_detalle": detalle or {},
                }).execute()
            except Exception:
                pass
        threading.Thread(target=_bg, daemon=True).start()

    def _record_error(self, method, error):
        count = self._errors.get(method, 0) + 1
        self._errors[method] = count
        msg = str(error)
        if any(s in msg for s in ("1114", "DLL", "WinError")) or count >= self._MAX_ERR:
            self._disabled.add(method)
            logger.warning(f"'{method}' deshabilitado: {type(error).__name__}")

    def _process(self, frame):
        h, w = frame.shape[:2]
        mx = 480
        if h > mx or w > mx:
            s = min(mx/h, mx/w)
            frame = cv2.resize(frame, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)

        # Telemetria de quality gate — clave para debuguear "no me reconoce".
        # Logueamos las 3 metricas cada intento para que el log de la
        # estacion en el panel muestre POR QUE falla un intento.
        _mean = _std = _lap = 0.0
        try:
            _gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            _mean = float(_gray.mean()); _std = float(_gray.std())
            _lap  = float(cv2.Laplacian(_gray, cv2.CV_64F).var())
            logger.info(
                f"RecogProcess: frame {frame.shape[1]}x{frame.shape[0]} "
                f"brillo={_mean:.0f} std={_std:.0f} lap={_lap:.0f}"
            )
        except Exception:
            pass

        # Subir un log al panel CADA 5 intentos para no saturar (suficiente
        # para diagnosticar "no me detecta" sin generar ruido).
        attempt = getattr(self, "_current_attempt", 0)
        should_log_panel = (attempt == 1 or attempt % 5 == 0)

        # Threshold de cosine raw para aceptar match. SFace usa 0.363 como
        # baseline; subimos a 0.40 para reducir FPs. La validacion del gap
        # vs segundo mejor ya esta dentro de recognize().
        MIN_COSINE = 0.40

        hybrid_ok = False
        hybrid_conf = 0.0
        hybrid_method = ""
        if "hybrid" not in self._disabled:
            try:
                from utils.hybrid_opencv_gemini_matcher import match_photo_hybrid
                ok, conf, info, method = match_photo_hybrid(frame, min_confidence=MIN_COSINE)
                hybrid_ok, hybrid_conf, hybrid_method = ok, float(conf), method
                if ok and info and conf >= MIN_COSINE:
                    self._errors.pop("hybrid", None)
                    self._log_panel(
                        "recognition_match",
                        attempt=attempt, method=method, conf=round(float(conf), 3),
                        empleado=info.get("nombre", "?"),
                        brillo=round(_mean), std=round(_std), lap=round(_lap),
                    )
                    self.results_ready.emit(True, conf, info, method)
                    return
            except Exception as e:
                self._record_error("hybrid", e)

        # A3: photo_to_photo_matcher (HOG+histos) genera falsos positivos
        # con embeddings modernos. Desactivado por default. Se puede
        # rehabilitar con env STATION_ENABLE_PHOTO_MATCHER=true para tests.
        import os
        photo_matcher_enabled = os.environ.get("STATION_ENABLE_PHOTO_MATCHER", "false").lower() in ("true", "1", "yes")
        if photo_matcher_enabled and "photo_matcher" not in self._disabled:
            try:
                from utils.photo_to_photo_matcher import match_photo_from_frame
                ok, conf, info = match_photo_from_frame(frame, min_confidence=MIN_COSINE)
                if ok and info and conf >= MIN_COSINE:
                    self._errors.pop("photo_matcher", None)
                    self.results_ready.emit(True, conf, info, "Foto")
                    return
            except Exception as e:
                self._record_error("photo_matcher", e)

        opencv_ok = False
        opencv_conf = 0.0
        if "opencv" not in self._disabled:
            try:
                from utils.face_recognition_opencv import recognize_opencv
                ok, conf, info = recognize_opencv(frame)
                opencv_ok, opencv_conf = ok, float(conf)
                logger.info(f"RecogProcess: opencv -> ok={ok} conf={conf:.3f}")
                if ok and info:
                    self._errors.pop("opencv", None)
                    self._log_panel(
                        "recognition_match",
                        attempt=attempt, method="OpenCV", conf=round(float(conf), 3),
                        empleado=info.get("nombre", "?"),
                        brillo=round(_mean), std=round(_std), lap=round(_lap),
                    )
                    self.results_ready.emit(True, conf, info, "OpenCV")
                    return
            except Exception as e:
                self._record_error("opencv", e)

        # Nada hizo match. Logueamos al panel cada N intentos para que
        # el admin vea EXACTAMENTE por que no detecto: brillo del frame,
        # confianza obtenida por cada motor, etc.
        if should_log_panel:
            self._log_panel(
                "recognition_no_match",
                attempt=attempt,
                brillo=round(_mean), std=round(_std), lap=round(_lap),
                hybrid_conf=round(hybrid_conf, 3),
                hybrid_method=hybrid_method or "none",
                opencv_conf=round(opencv_conf, 3),
                disabled=list(self._disabled),
            )
        self.results_ready.emit(False, 0.0, None, "")


# ═════════════════════════════════════════════════════════════════════════════
#  Bridge Python ↔ JS
# ═════════════════════════════════════════════════════════════════════════════
class _Bridge(QObject):
    start_camera_requested     = pyqtSignal()
    stop_camera_requested      = pyqtSignal()
    register_requested         = pyqtSignal()
    start_enrollment_requested = pyqtSignal()
    logout_requested           = pyqtSignal()
    stats_requested            = pyqtSignal()
    employees_requested        = pyqtSignal()
    manual_requested           = pyqtSignal(str, str)
    save_config_requested      = pyqtSignal(str)
    relaunch_setup_requested   = pyqtSignal()
    sync_requested             = pyqtSignal()

    @pyqtSlot()
    def getStats(self):
        self.stats_requested.emit()

    @pyqtSlot()
    def getEmployees(self):
        self.employees_requested.emit()

    @pyqtSlot(str, str)
    def registerManual(self, emp_id, tipo):
        self.manual_requested.emit(emp_id, tipo)

    @pyqtSlot(str)
    def saveStationConfig(self, name):
        self.save_config_requested.emit(name)

    @pyqtSlot()
    def relaunchSetup(self):
        self.relaunch_setup_requested.emit()

    @pyqtSlot()
    def syncEmployees(self):
        self.sync_requested.emit()

    @pyqtSlot()
    def startCamera(self):
        self.start_camera_requested.emit()

    @pyqtSlot()
    def stopCamera(self):
        self.stop_camera_requested.emit()

    @pyqtSlot()
    def registerAttendance(self):
        self.register_requested.emit()

    @pyqtSlot()
    def startEnrollment(self):
        self.start_enrollment_requested.emit()

    @pyqtSlot()
    def logout(self):
        self.logout_requested.emit()



# ═════════════════════════════════════════════════════════════════════════════
#  DashboardWindow
# ═════════════════════════════════════════════════════════════════════════════
class DashboardWindow(QMainWindow):

    def __init__(self, trabajador=None):
        super().__init__()
        self.trabajador       = trabajador  # None en modo kiosco
        self._cam_thread      = None
        self._rec_thread      = None
        self._current_frame   = None
        self._attendance_done = False
        self._active_dialog   = False
        self._last_rec_ts     = 0.0
        self._prep_count      = 0
        self._prep_done       = False  # True tras terminar la cuenta atras
        self._prep_timer      = None
        self._last_frame_ts   = 0.0
        self._had_face        = False
        self._last_avatar_b64 = ""
        self._last_info       = None

        # ── Modo bandeja (Opción A) ──────────────────────────────────────
        # La app vive en la bandeja del sistema. En segundo plano: cámara
        # APAGADA (nadie se ficha por accidente) pero heartbeat vivo → la
        # estación se mantiene VERDE en el mapa. Al abrir la ventana la
        # cámara prende y ya se puede fichar.
        self._tray            = None
        self._quitting        = False   # True solo cuando el usuario elige "Salir"
        self._en_bandeja      = True    # arranca en segundo plano (cámara apagada)

        self._ui_initialized = False  # guard para evitar doble init
        self._init_ui()
        self._setup_tray()

    def _init_ui(self):
        self.setWindowTitle("Safe Link Monitoring — Estación de Acceso")
        self.setMinimumSize(1080, 640)
        self.resize(1280, 760)
        self.setStyleSheet("QMainWindow{background:#070810}")

        self._view = QWebEngineView()

        # Configurar ANTES de cargar cualquier contenido
        s = self._view.settings()
        s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
        s.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
        s.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
        s.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
        s.setAttribute(QWebEngineSettings.WebGLEnabled, True)
        s.setAttribute(QWebEngineSettings.ScrollAnimatorEnabled, False)

        self._channel = QWebChannel()
        self._bridge  = _Bridge()
        self._channel.registerObject("bridge", self._bridge)
        self._view.page().setWebChannel(self._channel)

        self._bridge.start_camera_requested.connect(self._start_camera)
        self._bridge.stop_camera_requested.connect(self._stop_camera)
        self._bridge.register_requested.connect(self._register_attendance)
        self._bridge.start_enrollment_requested.connect(self._open_enrollment)
        self._bridge.logout_requested.connect(self._logout)
        self._bridge.stats_requested.connect(self._load_stats)
        self._bridge.employees_requested.connect(self._load_employees)
        self._bridge.manual_requested.connect(self._register_manual)
        self._bridge.save_config_requested.connect(self._save_config)
        self._bridge.relaunch_setup_requested.connect(self._relaunch_setup)
        self._bridge.sync_requested.connect(self._sync_employees)

        # Capturar errores JS y mensajes de consola. Filtramos warnings
        # conocidos e inocuos (ej. AudioContext bloqueado por Chrome en
        # modo kiosko sin gesto del usuario) para no llenar el log de ruido
        # y que se vean solo los errores reales.
        try:
            from PyQt5.QtWebEngineWidgets import QWebEnginePage

            _NOISE_PATTERNS = (
                "AudioContext was not allowed",
                "must be resumed (or created) after a user gesture",
            )

            def _js_console(self_page, level, msg, line, source):
                if any(p in msg for p in _NOISE_PATTERNS):
                    return  # Silenciar spam conocido inofensivo
                tag = ["LOG", "WARN", "ERR"][min(int(level), 2)]
                logger.info(f"[JS-{tag}] {msg} ({source}:{line})")

            QWebEnginePage.javaScriptConsoleMessage = _js_console
        except Exception:
            pass

        self._view.page().loadStarted.connect(lambda: logger.info("WebEngine: load started"))

        def _on_progress(p):
            if p in (25, 50, 75, 100):
                logger.info(f"WebEngine: {p}%")
            if p >= 100 and not self._ui_initialized:
                # No esperar loadFinished — disparar inicialización al llegar a 100%
                QTimer.singleShot(500, lambda: self._on_load(True))

        self._view.page().loadProgress.connect(_on_progress)
        self._view.page().loadFinished.connect(self._on_load)
        # Fallback final: si nada dispara en 15s, continuar igual
        QTimer.singleShot(15000, lambda: self._on_load(True))

        # Cargar contenido
        import os
        import sys
        is_dev = os.getenv("STATION_DEV") == "1"

        if is_dev:
            logger.info("Modo Desarrollo: Cargando http://localhost:5173")
            self._view.load(QUrl("http://localhost:5173"))
        else:
            # Resolver la ruta del frontend/dist/index.html con soporte
            # para 3 ubicaciones posibles:
            #
            #  1. Dev local: station/frontend/dist/index.html relativo al
            #     archivo Python.
            #  2. PyInstaller --onefile: archivos extraidos a
            #     sys._MEIPASS (carpeta temporal).
            #  3. PyInstaller --onedir (caso actual del .exe): archivos
            #     junto al ejecutable en _internal/ o dentro de la
            #     carpeta de instalacion.
            #
            # Antes este codigo solo cubria el caso 1 -> en el .exe
            # caia al fallback feo de _FALLBACK_HTML, lo que explica
            # "no se ve como en local".
            candidates = []

            # 1. Dev local (relativo al archivo Python)
            candidates.append(
                Path(__file__).parent.parent.parent / "frontend" / "dist" / "index.html"
            )

            # 2. PyInstaller _MEIPASS (--onefile o --onedir con extraccion)
            meipass = getattr(sys, "_MEIPASS", None)
            if meipass:
                candidates.append(Path(meipass) / "frontend" / "dist" / "index.html")

            # 3. Junto al ejecutable cuando esta congelado (--onedir)
            if getattr(sys, "frozen", False):
                exe_dir = Path(sys.executable).parent
                candidates.append(exe_dir / "frontend" / "dist" / "index.html")
                # PyInstaller --onedir 6.x mete data en _internal/
                candidates.append(exe_dir / "_internal" / "frontend" / "dist" / "index.html")

            frontend_path = next((p for p in candidates if p.exists()), None)

            if frontend_path is not None:
                url = QUrl.fromLocalFile(str(frontend_path.absolute()))
                logger.info(f"Cargando UI React desde {url.toString()}")
                self._view.load(url)
            else:
                tried = "\n  ".join(str(p) for p in candidates)
                logger.warning(
                    f"React dist no encontrada en ninguna ubicacion — "
                    f"usando fallback embebido. Probadas:\n  {tried}"
                )
                self._view.setHtml(_HTML)

        container = QWidget()
        lay = QVBoxLayout(container)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)
        lay.addWidget(self._view)
        self.setCentralWidget(container)

    def _js(self, code: str):
        self._view.page().runJavaScript(code)

    def _on_load(self, ok):
        if self._ui_initialized:
            return
        logger.info("WebEngine cargado — inicializando UI de la estación")
        # No esperar a React: arrancar inmediatamente. Los main.tsx ya registran
        # los globals como noop, y React los reemplazará cuando monte.
        QTimer.singleShot(300, self._init_station_ui)

    def _init_station_ui(self):
        """Inicializa la UI de la estación — solo cuando React ya está listo. Corre una sola vez."""
        if self._ui_initialized:
            return
        self._ui_initialized = True
        if self.trabajador:
            nombre = f"{self.trabajador.nombre} {self.trabajador.apellido}"
            self._js(f"setUser({nombre!r});")
        self._js("setStatus('Sistema listo', '');")

        # Nombre de estación y sucursal desde StationInfo
        try:
            from utils.station_manager import StationInfo
            st_name   = StationInfo.nombre   or "Estación"
            st_branch = StationInfo.sucursal_id or "Sin sucursal"
            st_branch_label = StationInfo.config.get("sucursal_nombre") or st_branch
            self._js(f"setStationInfo({st_name!r}, {st_branch_label!r});")
            try:
                from utils.station_manager import get_station
                mgr = get_station()
                mgr.status_changed.connect(self._on_heartbeat_status)
            except Exception:
                pass
        except Exception:
            self._js("setStationInfo('Estación', '');")

        # Arrancar servicios escalonadamente. El reconocimiento facial
        # arranca PRIMERO (T+500ms) porque _prep_tick chequea
        # self._rec_thread al finalizar la preparacion (~T+6s); si no
        # existe aun, la deteccion nunca arranca por race condition.
        QTimer.singleShot(500,  self._init_face_recognition)
        QTimer.singleShot(800,  self._load_last_registration)
        QTimer.singleShot(1500, self._start_camera)
        QTimer.singleShot(3000, self._start_sync_manager)
        QTimer.singleShot(4000, self._start_realtime_listener)

    def _on_heartbeat_status(self, state: str, msg: str):
        online = state == "online"
        self._js(f"setConnectivity({str(online).lower()}, {msg!r});")
        self._push_health_to_ui()

    # ── SyncManager ───────────────────────────────────────────────────────────

    def _start_sync_manager(self):
        try:
            from utils.sync_manager import get_sync_manager
            self._sync_mgr = get_sync_manager()
            self._sync_mgr.sync_started.connect(lambda: self._js("setStatus('Sincronizando empleados...', 'warn');"))
            self._sync_mgr.sync_done.connect(self._on_sync_done)
            self._sync_mgr.sync_error.connect(lambda msg: logger.warning(f"Sync error: {msg}"))
            self._sync_mgr.start()
        except Exception as e:
            logger.error(f"SyncManager init error: {e}")

    def _on_sync_done(self, count: int):
        logger.info(f"Sync completado: {count} empleados")
        self._js("setStatus('Sistema listo', 'ok');")
        # Reapuntar matchers al caché de la empresa
        try:
            cache_dir = self._sync_mgr.get_cache_dir()
            if cache_dir:
                self._reload_matchers_from_cache(cache_dir)
        except Exception:
            pass
        # Actualizar health panel en React
        self._push_health_to_ui()

    def _push_health_to_ui(self):
        try:
            from utils.station_manager import (
                _health_empleados_count, _health_camara_ok, _health_encodings_ver
            )
            score = 0
            if _health_camara_ok is True:         score += 30
            if _health_empleados_count > 0:       score += 40
            if _health_encodings_ver > 0:         score += 30
            camara_js = "true" if _health_camara_ok is True else ("false" if _health_camara_ok is False else "null")
            self._js(f"window.setHealth && window.setHealth({score},{_health_empleados_count},{camara_js},{_health_encodings_ver});")
        except Exception:
            pass

    def _reload_matchers_from_cache(self, cache_dir):
        """Resetea TODOS los matchers tras un sync exitoso, asi el cache_dir
        recien resuelto (con empresa_id real) reemplaza el path placeholder
        del arranque. Antes solo se reseteaba hybrid y photo, pero el
        recognizer OpenCV (singleton interno) quedaba con el path legacy
        y siempre retornaba 'No se encontraron encodings previos'."""
        try:
            import utils.hybrid_opencv_gemini_matcher as hm
            import utils.photo_to_photo_matcher as pm
            from utils.face_recognition_opencv import (
                reset_opencv_recognizer, get_opencv_recognizer,
            )

            hm._hybrid_matcher = None
            pm._photo_matcher = None
            reset_opencv_recognizer()

            # Re-inicializar con el cache_dir correcto. get_opencv_recognizer
            # ahora detecta el cambio de path y recrea el singleton.
            get_opencv_recognizer(database_dir=cache_dir)
            hm.get_hybrid_matcher(database_dir=cache_dir)
            pm.get_photo_matcher(database_dir=cache_dir)
            logger.info(f"Matchers recargados desde cache: {cache_dir}")
        except Exception as e:
            logger.warning(f"reload matchers: {e}")

    # ── Polling de comandos (reemplaza Realtime — supabase-py sync no lo soporta) ──

    def _start_realtime_listener(self):
        """Realtime para comandos + polling como fallback (cada 30s)."""
        from utils.station_manager import StationInfo
        dispositivo_id = StationInfo.dispositivo_id

        # Suscripción Realtime — recibe comandos en <500ms
        if dispositivo_id:
            try:
                from utils.realtime_listener import RealtimeCommandListener
                self._rt_listener = RealtimeCommandListener(
                    dispositivo_id=dispositivo_id,
                    on_command=self._on_realtime_command,
                )
                self._rt_listener.start()
            except Exception as e:
                logger.warning(f"Realtime no disponible: {e}")

        # Fallback polling cada 2 min (recoge lo que Realtime pueda perder si
        # el WebSocket se desconectó silenciosamente). Realtime es la fuente
        # primaria ahora — ~720× menos requests que el polling de 10s anterior.
        self._cmd_poll_timer = QTimer(self)
        self._cmd_poll_timer.setInterval(120_000)
        self._cmd_poll_timer.timeout.connect(self._poll_commands)
        self._cmd_poll_timer.start()
        QTimer.singleShot(800, self._poll_commands)
        logger.info("Listener de comandos iniciado (Realtime + polling fallback 2min)")

    def _on_realtime_command(self, cmd: dict):
        """Callback desde RealtimeListener — corre en thread del listener,
        delegamos al hilo principal vía QTimer.singleShot."""
        from utils.station_manager import get_station_api_key
        api_key = get_station_api_key()
        sb = get_supabase_client()
        if not api_key or not sb:
            return
        QTimer.singleShot(0, lambda: self._execute_command(cmd, api_key, sb))

    def _poll_commands(self):
        """Consulta comandos_estacion en background — nunca bloquea la UI."""
        if getattr(self, "_polling", False):
            return
        self._polling = True

        import threading
        def _bg():
            try:
                from utils.station_manager import StationInfo, get_station_api_key
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

        threading.Thread(target=_bg, daemon=True).start()

    def _execute_command(self, cmd: dict, api_key: str, sb):
        tipo   = cmd.get("tipo", "")
        cmd_id = cmd.get("id", "")

        # Deduplicación: si ya procesamos este cmd_id en esta sesión, ignorar
        if cmd_id:
            if not hasattr(self, "_seen_cmds"):
                self._seen_cmds = set()
            if cmd_id in self._seen_cmds:
                return
            self._seen_cmds.add(cmd_id)

        resultado = "ok"
        try:
            if tipo == "sync_empleados":
                logger.info(f"Comando recibido: sync_empleados ({cmd_id[:8] if cmd_id else '?'})")
                if hasattr(self, "_sync_mgr"):
                    self._sync_mgr.force_sync()
            elif tipo == "reiniciar_app":
                logger.info(f"Comando recibido: reiniciar_app ({cmd_id[:8] if cmd_id else '?'})")
                QTimer.singleShot(1000, self._logout)
            elif tipo == "limpiar_cache":
                logger.info(f"Comando recibido: limpiar_cache ({cmd_id[:8] if cmd_id else '?'})")
            elif tipo == "forzar_reenroll":
                # S2.2: admin forzo regeneracion de embeddings para 1 empleado.
                # El backend ya borro los embeddings de pgvector y marco
                # enrollado=false. Aqui solo gatillamos un sync forzado.
                payload = cmd.get("payload") or {}
                emp_id = payload.get("empleado_id", "")
                logger.info(
                    f"Comando recibido: forzar_reenroll empleado={emp_id[:8] if emp_id else '?'} "
                    f"({cmd_id[:8] if cmd_id else '?'})"
                )
                if hasattr(self, "_sync_mgr"):
                    self._sync_mgr.force_sync()
            else:
                logger.warning(f"Comando desconocido: {tipo}")
                resultado = f"tipo desconocido: {tipo}"
        except Exception as ex:
            logger.error(f"execute_command {tipo}: {ex}")
            resultado = f"error: {ex}"

        # Confirmar SIEMPRE en Supabase (incluso si la ejecución falló)
        # — así el web panel sabe que llegó y se mantiene el estado consistente.
        if cmd_id:
            try:
                sb.rpc("marcar_comando_ejecutado", {
                    "p_api_key": api_key,
                    "p_comando_id": cmd_id,
                    "p_resultado": resultado,
                }).execute()
            except Exception as ex:
                logger.warning(f"No se pudo marcar comando {cmd_id[:8]} como ejecutado: {ex}")

    # ── Offline queue ─────────────────────────────────────────────────────────

    def _flush_offline_queue(self):
        """Sube a Supabase las asistencias guardadas offline en SQLite."""
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia, Trabajador
            from utils.station_manager import get_station_api_key
            api_key = get_station_api_key()
            if not api_key:
                return
            sb = get_supabase_client()
            if not sb:
                return
            db = get_db_session()
            try:
                pendientes = (
                    db.query(RegistroAsistencia)
                    .filter(RegistroAsistencia.sincronizado == False)  # noqa: E712
                    .limit(50)
                    .all()
                )
                for reg in pendientes:
                    trab = db.query(Trabajador).filter(Trabajador.id == reg.trabajador_id).first()
                    if not trab or not trab.supabase_uuid:
                        continue
                    try:
                        result = sb.rpc("registrar_asistencia_station", {
                            "p_api_key": api_key,
                            "p_empleado_id": trab.supabase_uuid,
                            "p_tipo": reg.tipo,
                            "p_confianza": float(reg.confianza or 0),
                            "p_score_raw": float(reg.score_raw) if reg.score_raw is not None else None,
                            "p_metodo": reg.metodo,
                            "p_embedding_count": reg.embedding_count,
                        }).execute()
                        if result.data and result.data.get("ok"):
                            reg.sincronizado = True
                    except Exception:
                        pass
                db.commit()
                synced = sum(1 for r in pendientes if r.sincronizado)
                if synced:
                    logger.info(f"Offline queue: {synced} asistencias subidas")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"flush_offline_queue: {e}")

    def _init_face_recognition(self):
        """Inicializa el sistema facial. Crea el thread y lo deja listo
        para arrancar cuando _prep_tick (o el failsafe) lo dispare."""
        _lazy_load_face_recognition()
        self._rec_thread = _RecognitionThread(self)
        self._rec_thread.results_ready.connect(self._on_recognition)

        # Reportar al panel que el reconocimiento esta inicializado.
        # Util para distinguir "thread creado" vs "thread procesando".
        self._log_to_panel(
            "recognition_init",
            available=bool(FACE_RECOGNITION_AVAILABLE),
            has_init_fn=bool(inicializar_sistema_facial),
        )

        if not (FACE_RECOGNITION_AVAILABLE and inicializar_sistema_facial):
            self._js("setStatus('Reconocimiento no disponible', 'warn');")
            self._log_to_panel("recognition_unavailable")
            return

        import threading
        def _bg_init():
            try:
                try:
                    from utils.register_photos import register_photos_from_database
                    register_photos_from_database()
                except Exception:
                    pass
                inicializar_sistema_facial()
                # NO sobreescribir el status aqui — _prep_tick ya puso
                # "Buscando rostro..." y nos sobreescribir crearia
                # confusion ("Sistema listo" en pantalla cuando en
                # realidad esta buscando rostro).
                self._log_to_panel("recognition_ready")
            except Exception as e:
                logger.error(f"init facial: {e}")
                self._log_to_panel("recognition_init_error", error=str(e)[:200])
                QTimer.singleShot(0, lambda: self._js("setStatus('Reconocimiento parcial', 'warn');"))
        threading.Thread(target=_bg_init, daemon=True).start()

    def _log_to_panel(self, tipo: str, **detalle):
        """Sube un log de la estacion al panel (logs_estacion). Best-effort:
        falla silencioso si no hay red o api_key — sirve solo para debug
        remoto, no debe romper el flujo del dashboard."""
        import threading
        def _bg():
            try:
                from utils.station_manager import get_station_api_key
                api_key = get_station_api_key()
                sb = get_supabase_client()
                if not api_key or not sb:
                    return
                sb.rpc("insertar_log_estacion", {
                    "p_api_key": api_key,
                    "p_tipo": tipo,
                    "p_detalle": detalle or {},
                }).execute()
            except Exception:
                pass
        threading.Thread(target=_bg, daemon=True).start()

    def _start_camera(self):
        # En segundo plano (bandeja) la cámara permanece apagada para no
        # fichar a quien esté usando la PC. Solo prende al abrir la ventana.
        if self._en_bandeja:
            return
        if self._cam_thread:
            return
        self._js("setCamState('connecting');")
        self._js("setStatus('Conectando cámara...', 'warn');")
        self._cam_thread = _CameraThread(0)
        self._cam_thread.frame_ready.connect(self._on_frame)
        self._cam_thread.camera_started.connect(self._on_cam_started)
        QTimer.singleShot(50, self._cam_thread.start_camera)

    def _on_cam_started(self, ok):
        try:
            from utils.station_manager import report_health
            report_health(camara_ok=ok)
        except Exception:
            pass
        if not ok:
            self._cam_thread = None
            self._js("setCamState('error');")
            self._js("setStatus('Error: no se pudo acceder a la cámara', 'bad');")
            # Notificar al panel para que el admin se entere sin estar viendo la estacion
            try:
                from utils.sync_manager import _notify_panel
                from utils.station_manager import StationInfo
                _notify_panel(
                    tipo="station_camera_error",
                    severidad="error",
                    titulo=f"Cámara no disponible · {StationInfo.nombre or 'Estación'}",
                    mensaje="La estación no puede acceder a la cámara. Verifica conexión USB y permisos del SO.",
                    dedupe_key=f"cam-error:{StationInfo.dispositivo_id or 'unknown'}",
                )
            except Exception:
                pass
            return
        self._prep_count = 5
        self._prep_timer = QTimer(self)
        self._prep_timer.setInterval(1000)
        self._prep_timer.timeout.connect(self._prep_tick)
        self._prep_timer.start()
        self._prep_tick()

    def _prep_tick(self):
        if self._prep_count > 0:
            self._js(f"setCamState('preparing'); setBadgeText('ESPERA {self._prep_count}S');")
            self._js(f"setStatus('Acomódate frente a la cámara... {self._prep_count}s', 'warn');")
            self._prep_count -= 1
        else:
            self._prep_timer.stop()
            self._prep_done = True
            self._js("setCamState('live');")
            self._js("setStatus('Buscando rostro...', 'warn');")
            if self._rec_thread and not self._rec_thread.isRunning():
                self._rec_thread.start()

    def _stop_camera(self):
        if self._cam_thread:
            self._cam_thread.stop()
            self._cam_thread = None
        self._prep_done = False
        self._js("setCamState('offline');")
        self._js("setStatus('Sistema listo', '');")
        self._current_frame = None

    def _on_frame(self, frame: np.ndarray):
        if frame is None or frame.size == 0:
            return
        self._current_frame = frame

        # Throttle UI a ~25fps (40ms). 25fps es el sweet spot percibido
        # por el ojo humano como "fluido" sin saturar el canal JS.
        import time
        now = time.time()
        if now - self._last_frame_ts < 0.04:
            return
        self._last_frame_ts = now

        # Dibujar bbox del rostro detectado para feedback visual al
        # usuario. Le indica donde esta mirando el detector y reduce la
        # confusion ("no se si me esta viendo"). Se hace cada 3 frames
        # (~8fps) para no saturar CPU — la deteccion es relativamente
        # cara y la persistencia visual del bbox cubre los huecos.
        display_frame = frame
        self._bbox_skip = getattr(self, "_bbox_skip", 0) + 1
        if self._bbox_skip % 3 == 0:
            try:
                from utils.face_recognition_opencv import get_opencv_recognizer
                rec = get_opencv_recognizer()
                if rec is not None:
                    bbox = rec.detect_face(frame)
                    self._last_bbox = bbox  # cachear para frames intermedios
                else:
                    self._last_bbox = None
            except Exception:
                self._last_bbox = None

        bbox = getattr(self, "_last_bbox", None)
        if bbox is not None:
            display_frame = frame.copy()
            x1, y1, x2, y2 = bbox
            color = (0, 220, 130)  # verde menta — coincide con paleta UI
            cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
            # Corner marks tipo "viewfinder" — mas estetico que un cuadro lleno
            corner_len = max(12, (x2 - x1) // 8)
            for (px, py, dx, dy) in [
                (x1, y1, +1, +1), (x2, y1, -1, +1),
                (x1, y2, +1, -1), (x2, y2, -1, -1),
            ]:
                cv2.line(display_frame, (px, py), (px + dx*corner_len, py), color, 4)
                cv2.line(display_frame, (px, py), (px, py + dy*corner_len), color, 4)

        # JPEG quality 85: mejora visible sin impacto perceptible en tamaño.
        # JPEG quality 92: calidad alta para que la preview se vea
        # nitida (sin compresion visible). El tamaño sube de ~30KB a
        # ~50KB por frame — sin impacto perceptible en latencia del
        # bridge JS-Python.
        ok, buf = cv2.imencode('.jpg', display_frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if ok:
            b64 = base64.b64encode(buf.tobytes()).decode('ascii')
            self._js(f"updateFrame('{b64}');")

        # Failsafe: si el rec_thread existe pero no esta corriendo (race
        # con _prep_tick que solo intenta arrancarlo una sola vez al
        # terminar la preparacion), lo iniciamos aqui en cuanto el
        # primer frame valido aparece post-preparacion. Garantiza que
        # la deteccion siempre arranque aunque _init_face_recognition
        # haya tardado mas que el prep_timer (5s).
        if self._prep_done and self._rec_thread and not self._rec_thread.isRunning():
            try:
                self._rec_thread.start()
                self._js("setStatus('Buscando rostro...', 'warn');")
            except Exception:
                pass

        if self._rec_thread and self._rec_thread.isRunning() and not self._rec_thread.processing:
            import time as _t
            if _t.time() - self._last_rec_ts >= 0.5:
                self._last_rec_ts = _t.time()
                self._rec_thread.set_frame(frame)

    def _on_recognition(self, ok, conf, info, method):
        import time
        if ok and info:
            self._had_face = True
            self._last_info = info
            pct = conf * 100
            self._js(f"setConfidence({pct:.1f});")
            self._js(f"setStatus('Identificado — {method}', 'ok');")
            self._js(f"setEmployeeInfo({info.get('nombre','N/A')!r},{info.get('apellido','')!r},{info.get('zona','N/A')!r},{info.get('sucursal','N/A')!r},{info.get('puesto','N/A')!r});")

            try:
                from PyQt5.QtCore import QByteArray, QBuffer
                from PyQt5.QtGui import QPixmap
                # 1) Foto en caché local de la estación (formato SaaS: station/data/cache/<empresa>/photos/<uuid>.jpg)
                photo_path: Optional[Path] = None
                foto_local = info.get("foto_local")
                if foto_local and Path(foto_local).exists():
                    photo_path = Path(foto_local)
                else:
                    # 2) Fallback al mapper legacy (database_fotos/)
                    from utils.employee_mapper import get_photo_path as _legacy_get_photo
                    legacy_path = _legacy_get_photo(info.get("employee_id", 0))
                    if legacy_path and Path(legacy_path).exists():
                        photo_path = Path(legacy_path)

                if photo_path is not None:
                    px = QPixmap(str(photo_path))
                    if not px.isNull():
                        ba = QByteArray(); buf2 = QBuffer(ba)
                        buf2.open(QBuffer.WriteOnly); px.save(buf2, "JPEG", 80)
                        self._last_avatar_b64 = base64.b64encode(ba.data()).decode()
                        self._js(f"setAvatar('{self._last_avatar_b64}');")
            except Exception:
                self._last_avatar_b64 = ""

            # Threshold de auto-registro sobre cosine raw (no display
            # inflado). 0.40 coincide con MIN_COSINE del matcher: si el
            # motor ya valido que es la misma persona (paso threshold +
            # gap vs segundo mejor en recognize()), aceptamos el registro.
            #
            # Antes era 0.50 — pero matches legitimos a 0.42-0.48 se
            # mostraban en UI pero nunca disparaban auto_register,
            # generando confusion ("dice IDENTIFICADO pero no me ficha").
            # 0.40 es el threshold honesto: si paso los gates del
            # recognize(), el registro debe persistir.
            AUTO_REGISTER_THRESHOLD = 0.40
            if conf >= AUTO_REGISTER_THRESHOLD and not self._attendance_done:
                self._auto_register(info, conf, method)
        else:
            if time.time() - self._last_rec_ts > 3.0:
                self._js("setConfidence(-1);")
                self._js("setStatus('Buscando rostro...', 'warn');")
                self._js("resetEmployee();")
                if self._had_face:
                    self._js("showNotRecognized();")
                    self._had_face = False
                    self._last_avatar_b64 = ""
                    self._last_info = None

    def _auto_register(self, info: Dict, conf: float, method: str):
        if self._attendance_done or self._active_dialog:
            return
        try:
            from utils.database import get_db_session
            from utils.models import Trabajador
            eid_raw = info.get("employee_id", "")
            # En el flujo SaaS el employee_id es un UUID (string). El modelo legacy
            # guarda Integer en SQLite — usamos SHA-256 (estable entre procesos) para
            # mapear UUID -> int local. hash() de Python varia entre sesiones por
            # hash randomization, lo que creaba un Trabajador nuevo en cada arranque
            # y rompia el calculo de tipo entrada/salida.
            import hashlib
            uuid_str = str(eid_raw)
            try:
                eid_int = int(eid_raw) if not isinstance(eid_raw, str) or eid_raw.isdigit() else (int(hashlib.sha256(uuid_str.encode()).hexdigest(), 16) % (10**9))
            except Exception:
                eid_int = int(hashlib.sha256(uuid_str.encode()).hexdigest(), 16) % (10**9)

            db = get_db_session()
            try:
                trab = db.query(Trabajador).filter(Trabajador.employee_id == eid_int).first()
                if not trab:
                    nombre = info.get("nombre", "Empleado")
                    apellido = info.get("apellido", "")
                    if not apellido:
                        parts = nombre.split()
                        if len(parts) > 1:
                            nombre, apellido = parts[0], " ".join(parts[1:])
                    trab = Trabajador(
                        usuario=f"emp_{eid_int}",
                        password_hash="",
                        nombre=nombre,
                        apellido=apellido,
                        sucursal=info.get("sucursal", "N/A"),
                        zona=info.get("zona", "N/A"),
                        puesto=info.get("puesto", "N/A"),
                        employee_id=eid_int,
                        supabase_uuid=uuid_str,
                        activo=True,
                    )
                    db.add(trab); db.commit(); db.refresh(trab)
                elif trab.supabase_uuid != uuid_str:
                    trab.supabase_uuid = uuid_str
                    db.commit()
            finally:
                db.close()
            # Pasamos el UUID original a _register_db para usarlo en el RPC de Supabase
            self._register_db(trab, conf, info, method, supabase_empleado_uuid=uuid_str)
        except Exception as e:
            logger.error(f"auto_register: {e}")

    def _open_enrollment(self):
        """Abre la ventana de registro de nuevo empleado."""
        try:
            from windows.enrollment_window import EnrollmentWindow
            self._enrollment = EnrollmentWindow(self)
            self._enrollment.show()
        except Exception as e:
            logger.error(f"Error al abrir EnrollmentWindow: {e}")
            self._js(f"setStatus('Error al abrir registro: {e}', 'bad');")

    def _register_attendance(self):
        if self._current_frame is None:
            self._js("setStatus('Sin imagen — activa la cámara primero', 'bad');")
            return
        if self._attendance_done:
            return
        _lazy_load_face_recognition()
        if not FACE_RECOGNITION_AVAILABLE or reconocer_desde_frame is None:
            self._js("setStatus('Reconocimiento no disponible', 'bad');")
            return
        t_id  = self.trabajador.id if self.trabajador else None
        t_idx = getattr(self.trabajador, 'embedding_idx', None) if self.trabajador else None
        ok, conf, idx = reconocer_desde_frame(
            self._current_frame,
            trabajador_id=t_id,
            embedding_idx=t_idx,
        )
        if not ok or conf < 0.85:
            self._js(f"setStatus('No reconocido — {conf*100:.0f}%', 'bad');")
            return
        if self.trabajador:
            self._register_db(self.trabajador, conf, None, "manual")

    def _register_db(self, trab, conf, info, method, supabase_empleado_uuid: Optional[str] = None):
        """
        1. Guarda en SQLite local (siempre, funciona offline).
        2. Sube a Supabase via RPC registrar_asistencia_station (si hay internet).
        3. Si falla la nube, marca sincronizado=False para el offline queue.
        4. Muestra diálogo de confirmación en React.
        5. Intenta flush de la cola offline.
        """
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia
            from sqlalchemy import func
            from utils.station_manager import get_station_api_key

            db  = get_db_session()
            hoy = datetime.now().date()
            ahora = datetime.now()

            try:
                ultimo = (
                    db.query(RegistroAsistencia)
                    .filter(
                        RegistroAsistencia.trabajador_id == trab.id,
                        func.date(RegistroAsistencia.timestamp) == hoy,
                    )
                    .order_by(RegistroAsistencia.timestamp.desc()).first()
                )

                if ultimo:
                    secs_since = (ahora - ultimo.timestamp).total_seconds()
                    if secs_since < 60:
                        hora_ult = ultimo.timestamp.strftime("%H:%M")
                        self._js(f"showAlreadyRegistered({ultimo.tipo!r}, {hora_ult!r});")
                        db.close()
                        return

                tipo = "salida" if ultimo and ultimo.tipo == "entrada" else "entrada"

                # 1. Guardar localmente (siempre). A7: persistir tambien
                # score_raw, metodo y embedding_count para auditoria.
                _score_raw = info.get("_score_raw") if info else None
                _metodo = info.get("_metodo") if info else (method or None)
                _embedding_count = info.get("_embedding_count") if info else None
                reg = RegistroAsistencia(
                    trabajador_id=trab.id,
                    timestamp=ahora,
                    tipo=tipo,
                    reconocimiento_facial=True,
                    confianza=conf,
                    ubicacion=(info.get("sucursal", "N/A") if info else getattr(trab, "sucursal", "N/A")),
                    sincronizado=False,
                    score_raw=_score_raw,
                    metodo=_metodo,
                    embedding_count=_embedding_count,
                )
                db.add(reg)
                db.commit()
                db.refresh(reg)
                self._attendance_done = True
                self._update_last_reg(tipo, ahora)
            finally:
                db.close()

            # Datos para la UI
            nombre_display = info.get("nombre", "Trabajador") if info else f"{trab.nombre} {trab.apellido}"
            apellido_display = info.get("apellido", "") if info else ""
            hora = ahora.strftime("%H:%M:%S")
            avatar = self._last_avatar_b64 or ""

            # 2. Mostrar overlay de confirmación en React
            self._active_dialog = True
            apellido_js = apellido_display if apellido_display else ""
            self._js(
                f"showAttendanceConfirmed({nombre_display!r},{apellido_js!r},"
                f"{tipo!r},{hora!r},{avatar!r});"
            )

            # 3. Subir a Supabase via RPC (con api_key — no requiere auth).
            # A7: enviamos score_raw + metodo + embedding_count para
            # tracking real de calidad. Los metadatos vienen anotados
            # en `info` desde recognize() (claves _score_raw, _metodo,
            # _embedding_count). Si no existen (motor legacy), va NULL.
            ok_cloud = False
            try:
                api_key = get_station_api_key()
                sb = get_supabase_client()
                if api_key and sb and supabase_empleado_uuid:
                    score_raw = info.get("_score_raw") if info else None
                    metodo = info.get("_metodo") if info else (method or None)
                    embedding_count = info.get("_embedding_count") if info else None
                    result = sb.rpc("registrar_asistencia_station", {
                        "p_api_key": api_key,
                        "p_empleado_id": supabase_empleado_uuid,
                        "p_tipo": tipo,
                        "p_confianza": float(conf),
                        "p_notas": method or "",
                        "p_score_raw": float(score_raw) if score_raw is not None else None,
                        "p_metodo": metodo,
                        "p_embedding_count": int(embedding_count) if embedding_count is not None else None,
                    }).execute()
                    if result.data and result.data.get("ok"):
                        ok_cloud = True
                        db2 = get_db_session()
                        try:
                            r = db2.query(RegistroAsistencia).filter(RegistroAsistencia.id == reg.id).first()
                            if r:
                                r.sincronizado = True
                                db2.commit()
                        finally:
                            db2.close()
            except Exception as es:
                logger.warning(f"Supabase sync fallo (se reintentará): {es}")

            status_msg = "Registro en nube ✓" if ok_cloud else "Registro local (sin conexión)"
            self._js(f"setStatus({status_msg!r}, 'ok');")

            # A6: Beep de confirmacion para feedback audible. Util en
            # ambientes ruidosos donde el empleado no mira la pantalla.
            # Opcional via env STATION_BEEP_ON_SUCCESS (default true).
            # Usamos winsound (stdlib Windows) — sin dependencias extra.
            #
            # IMPORTANTE: winsound.Beep BLOQUEA el thread llamante mientras
            # suena. Si se llama desde el thread principal (Qt event loop),
            # la UI se congela ~400ms. Lo lanzamos en un thread daemon
            # separado para no afectar la fluidez del feedback visual.
            import os
            beep_enabled = os.environ.get("STATION_BEEP_ON_SUCCESS", "true").lower() in ("true", "1", "yes")
            if beep_enabled:
                import threading

                def _play_beep():
                    try:
                        import winsound
                        # 3 tonos ascendentes mas largos y audibles —
                        # claros en ambiente ruidoso de kiosko/oficina.
                        winsound.Beep(800, 150)
                        winsound.Beep(1000, 150)
                        winsound.Beep(1300, 200)
                        logger.info("Beep de asistencia reproducido")
                    except Exception as e:
                        logger.warning(f"winsound.Beep fallo: {e}")

                threading.Thread(target=_play_beep, daemon=True).start()

            # 4. Agregar al historial reciente
            nombre_full = f"{nombre_display} {apellido_display}".strip()
            self._js(f"addRecentRecord({nombre_full!r}, {tipo!r}, {hora!r});")

            # 5. Intentar flush de cola offline en background
            QTimer.singleShot(2000, self._flush_offline_queue)

            # 6. Despues de 4s, volver a segundo plano automaticamente.
            #
            # Default: STATION_AUTO_CLOSE=true. Tras un fichaje exitoso la
            # estacion se esconde en la bandeja (cámara apagada, heartbeat
            # vivo → sigue verde). Evita doble fichaje accidental por quedarse
            # frente a la cámara y devuelve la pantalla a la persona.
            # (Sin bandeja disponible cae a cierre clásico — ver
            # _close_station_after_attendance.)
            #
            # Para "kiosko continuo" (atender fila sin reabrir entre cada uno),
            # set STATION_AUTO_CLOSE=false en el .env: la ventana queda abierta.
            import os
            auto_close = os.environ.get("STATION_AUTO_CLOSE", "true").lower() in ("true", "1", "yes")
            if auto_close:
                QTimer.singleShot(4000, self._close_station_after_attendance)
            else:
                QTimer.singleShot(4000, self._reset_after_attendance)

        except Exception as e:
            logger.error(f"_register_db: {e}")

    def _reset_after_attendance(self):
        """Resetea el estado kiosco después de un registro."""
        self._attendance_done = False
        self._active_dialog = False
        self._had_face = False
        self._last_avatar_b64 = ""
        self._last_info = None
        self._js("resetEmployee();")
        self._js("setBadgeText('');")
        self._js("setStatus('Buscando rostro...', 'warn');")

    def _close_station_after_attendance(self):
        """Tras confirmar la asistencia, vuelve a segundo plano.

        Con bandeja activa: se esconde (cámara apagada, heartbeat vivo → la
        estación sigue VERDE en el mapa, y la persona recupera su pantalla
        sin riesgo de fichajes accidentales). Sin bandeja (kiosco dedicado):
        cierra como antes."""
        if self._tray is not None:
            logger.info("Asistencia confirmada — volviendo a segundo plano")
            self._hide_to_tray()
            return
        from PyQt5.QtWidgets import QApplication
        logger.info("Asistencia confirmada — cerrando estación")
        try:
            self.close()
        except Exception:
            pass
        QApplication.quit()

    def _load_last_registration(self):
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia
            from sqlalchemy import func
            db  = get_db_session()
            hoy = datetime.now().date()
            q = db.query(RegistroAsistencia).filter(
                func.date(RegistroAsistencia.timestamp) == hoy,
            )
            if self.trabajador:
                q = q.filter(RegistroAsistencia.trabajador_id == self.trabajador.id)
            last = q.order_by(RegistroAsistencia.timestamp.desc()).first()
            db.close()
            if last:
                self._update_last_reg(last.tipo, last.timestamp)
        except Exception:
            pass

    def _update_last_reg(self, tipo, ts):
        hora  = ts.strftime("%H:%M:%S") if hasattr(ts, "strftime") else str(ts)
        color = "var(--green)" if tipo == "entrada" else "var(--accent)"
        self._js(f"setLastReg({(tipo.upper() + '  ' + hora)!r}, {color!r});")
        # Also add to the recent list
        if self.trabajador:
            nombre = f"{self.trabajador.nombre} {self.trabajador.apellido}"
        else:
            nombre = "Empleado"
        self._js(f"addRecentRecord({nombre!r}, {tipo!r}, {hora!r});")

    def _logout(self):
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        # Modo kiosco: nunca cierra, reinicia el estado en lugar de ir al login
        self._attendance_done = False
        self._had_face = False
        self._last_avatar_b64 = ""
        self._last_info = None
        self._js("resetEmployee();")
        self._js("setStatus('Sistema listo', '');")
        # Reiniciar cámara si se detuvo
        if not self._cam_thread:
            QTimer.singleShot(500, self._start_camera)

    def _load_stats(self):
        try:
            from utils.database import get_db_session
            from utils.models import RegistroAsistencia
            from sqlalchemy import func
            import json
            db = get_db_session()
            hoy = datetime.now().date()
            
            total = db.query(RegistroAsistencia).filter(func.date(RegistroAsistencia.timestamp) == hoy).count()
            entradas = db.query(RegistroAsistencia).filter(func.date(RegistroAsistencia.timestamp) == hoy, RegistroAsistencia.tipo == "entrada").count()
            salidas = db.query(RegistroAsistencia).filter(func.date(RegistroAsistencia.timestamp) == hoy, RegistroAsistencia.tipo == "salida").count()
            
            # Dummy history for Chart.js (to be replaced with real query if needed)
            data = {
                "total": total,
                "entradas_count": entradas,
                "salidas_count": salidas,
                "online": True,
                "labels": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
                "entradas_history": [max(0, entradas-5), max(0, entradas-2), entradas, entradas+1, entradas, entradas],
                "salidas_history": [0, 1, salidas, salidas+1, salidas, salidas]
            }
            db.close()
            self._js(f"renderStats({json.dumps(data)});")
        except Exception as e:
            logger.error(f"Error loading stats: {e}")

    def _load_employees(self):
        try:
            from utils.database import get_db_session
            from utils.models import Empleado
            import json
            db = get_db_session()
            emps = db.query(Empleado).all()
            list_data = []
            for e in emps:
                list_data.append({
                    "id": str(e.id),
                    "nombre": e.nombre,
                    "apellido": e.apellido,
                    "puesto": e.puesto or "Operativo"
                })
            db.close()
            self._js(f"setEmployees({json.dumps(list_data)});")
        except Exception as e:
            logger.error(f"Error loading emps: {e}")

    def _register_manual(self, emp_id, tipo):
        try:
            from utils.database import get_db_session
            from utils.models import Empleado, RegistroAsistencia
            import os
            db = get_db_session()
            emp = db.query(Empleado).filter(Empleado.id == emp_id).first()
            if not emp:
                self._js("alert('Error: Empleado no encontrado.');")
                return
            reg = RegistroAsistencia(
                trabajador_id=emp.id,
                tipo=tipo,
                sucursal_id=os.getenv("STATION_BRANCH_ID", "default"),
                timestamp=datetime.now()
            )
            db.add(reg)
            db.commit()
            db.close()
            self._js("alert('Registro manual guardado correctamente.');")
            self._load_stats()
        except Exception as e:
            logger.error(f"Manual reg error: {e}")

    def _save_config(self, name):
        # Update UI and log
        self._js(f"document.getElementById('sbName').textContent = {name!r};")
        logger.info(f"Config update: Station Name -> {name}")
        self._js("alert('Cambios aplicados localmente.');")

    def _relaunch_setup(self):
        try:
            self._stop_camera()
            from windows.provisioning_window import ProvisioningWindow
            self.setup_win = ProvisioningWindow()
            self.setup_win.show()
            self.close()
        except Exception as e:
            logger.error(f"Error relaunching setup: {e}")

    def _sync_employees(self):
        self._js("document.getElementById('sb-sync-status').textContent = 'Sincronizando...';")
        # Simular delay de red
        QTimer.singleShot(1500, lambda: self._js("document.getElementById('sb-sync-status').textContent = 'Sincronizado';"))

    def show(self):

        self.setWindowOpacity(0)
        super().show()
        self._fade = QPropertyAnimation(self, b"windowOpacity")
        self._fade.setDuration(350)
        self._fade.setStartValue(0.0)
        self._fade.setEndValue(1.0)
        self._fade.setEasingCurve(QEasingCurve.OutCubic)
        self._fade.start()

    # ── Bandeja del sistema (Opción A) ──────────────────────────────────
    def _setup_tray(self):
        """Crea el ícono de bandeja. La app nunca se cierra al pulsar la X:
        se esconde aquí y sigue corriendo en segundo plano (heartbeat vivo →
        verde en el mapa). Doble clic en el ícono la trae de vuelta."""
        if not QSystemTrayIcon.isSystemTrayAvailable():
            logger.warning("System tray no disponible — modo bandeja desactivado")
            return
        # icon.ico vive en src/assets/. En bundle PyInstaller _MEIPASS lo
        # extrae ahí también; si no se encuentra, QIcon queda vacío (la
        # bandeja igual funciona, solo sin ícono custom).
        from pathlib import Path
        icon_path = Path(__file__).resolve().parent.parent / "assets" / "icon.ico"
        icon = QIcon(str(icon_path))
        self._tray = QSystemTrayIcon(icon, self)
        self.setWindowIcon(icon)
        self._tray.setToolTip("Safe Link Monitoring — Estación")

        menu = QMenu()
        act_abrir = QAction("Abrir estación (fichar)", self)
        act_abrir.triggered.connect(self._restore_from_tray)
        menu.addAction(act_abrir)
        menu.addSeparator()
        act_salir = QAction("Salir por completo", self)
        act_salir.triggered.connect(self._quit_app)
        menu.addAction(act_salir)
        self._tray.setContextMenu(menu)

        # Doble clic (o clic en algunos OS) restaura la ventana.
        self._tray.activated.connect(self._on_tray_activated)
        self._tray.show()

    def start_in_background(self):
        """Arranca oculta en la bandeja: cámara apagada, heartbeat vivo.
        La estación queda VERDE en el mapa sin fichar a nadie hasta que el
        operador abra la ventana para registrar asistencia."""
        self._en_bandeja = True
        self.hide()
        try:
            self._tray.showMessage(
                "Safe Link Monitoring activa",
                "Estación en línea y monitoreando. Doble clic en este ícono para fichar.",
                QSystemTrayIcon.Information, 5000,
            )
        except Exception:
            pass

    def _on_tray_activated(self, reason):
        # Trigger = clic simple, DoubleClick = doble clic. Ambos abren.
        if reason in (QSystemTrayIcon.Trigger, QSystemTrayIcon.DoubleClick):
            self._restore_from_tray()

    def _hide_to_tray(self):
        """Esconde la ventana a la bandeja y APAGA la cámara. El heartbeat
        sigue corriendo (es un worker aparte) → la estación queda verde."""
        if self._tray is None:
            return  # sin bandeja, no escondemos (comportamiento normal)
        self._en_bandeja = True
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        self.hide()
        try:
            self._tray.showMessage(
                "Safe Link en segundo plano",
                "La estación sigue activa y en línea. Doble clic aquí para fichar.",
                QSystemTrayIcon.Information, 4000,
            )
        except Exception:
            pass

    def _restore_from_tray(self):
        """Trae la ventana al frente y PRENDE la cámara para fichar."""
        self._en_bandeja = False
        self.showMaximized()
        self.raise_()
        self.activateWindow()
        # Resetear estado de fichaje y arrancar cámara (pequeño delay para
        # que la ventana ya esté visible antes de pedir frames).
        self._attendance_done = False
        self._active_dialog   = False
        if not self._cam_thread:
            QTimer.singleShot(300, self._start_camera)

    def _quit_app(self):
        """Salida real (desde el menú de bandeja). Detiene todo y cierra."""
        self._quitting = True
        if self._tray:
            self._tray.hide()
        self.close()
        from PyQt5.QtWidgets import QApplication
        QApplication.quit()

    def changeEvent(self, ev):
        # Al minimizar manualmente, mandar a la bandeja en vez de dejar la
        # ventana en la barra de tareas con la cámara prendida.
        from PyQt5.QtCore import QEvent
        if (ev.type() == QEvent.WindowStateChange and self.isMinimized()
                and self._tray and not self._quitting):
            QTimer.singleShot(0, self._hide_to_tray)
        super().changeEvent(ev)

    def closeEvent(self, ev):
        # Pulsar la X NO cierra la app: la manda a la bandeja (queda verde).
        # Solo se cierra de verdad desde "Salir por completo" del menú.
        if not self._quitting and self._tray is not None:
            ev.ignore()
            self._hide_to_tray()
            return
        self._stop_camera()
        if self._rec_thread and self._rec_thread.isRunning():
            self._rec_thread.stop()
        # Detener sync_manager y realtime_listener para que el .exe
        # no quede zombie con QThreads activos despues de cerrar.
        if hasattr(self, "_sync_mgr") and self._sync_mgr is not None:
            try:
                self._sync_mgr.stop()
            except Exception as e:
                logger.warning(f"Error parando sync_manager: {e}")
        if hasattr(self, "_rt_listener") and self._rt_listener is not None:
            try:
                self._rt_listener.stop()
            except Exception as e:
                logger.warning(f"Error parando realtime_listener: {e}")
        ev.accept()
