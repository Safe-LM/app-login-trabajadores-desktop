"""
EnrollmentWindow — UI de captura facial para registrar empleados desde la estación.

Flujo:
    1. El usuario completa nombre, apellido, código y puesto.
    2. Acomoda al empleado frente a la cámara y presiona "Capturar".
    3. La ventana captura `TARGET_FRAMES` frames a intervalos regulares.
    4. Cada frame se previsualiza como miniatura junto a la barra de progreso.
    5. Al alcanzar el target se habilita "Guardar".
    6. EnrollmentService promedia los embeddings y sube el empleado + vector
       a Supabase en background. La UI muestra spinner y notifica resultado.

Diseño:
    - QWidget con layout PyQt nativo (no QWebEngineView aquí — esta ventana es
      modal, secundaria, y el HTML del dashboard ya consume mucho RAM).
    - Cámara en QThread reutilizable (vive durante toda la ventana).
    - El servicio corre en QRunnable; señales success/failure regresan al hilo
      principal vía Qt para evitar tocar widgets desde otro thread.
"""

from __future__ import annotations

import logging
from typing import List, Optional

import cv2
import numpy as np

from PyQt5.QtCore import QSize, Qt, QThread, QTimer, pyqtSignal
from PyQt5.QtGui import QImage, QPixmap
from PyQt5.QtWidgets import (
    QDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
    QProgressBar, QPushButton, QSizePolicy, QVBoxLayout, QWidget,
)

logger = logging.getLogger(__name__)

TARGET_FRAMES = 6
CAPTURE_INTERVAL_MS = 350


class _CameraThread(QThread):
    """Lee la webcam y emite frames BGR. Reutilizable entre capturas."""

    frame_ready = pyqtSignal(np.ndarray)
    camera_failed = pyqtSignal(str)

    def __init__(self, index: int = 0):
        super().__init__()
        self._index = index
        self._running = False

    def run(self):
        cap = cv2.VideoCapture(self._index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(self._index)
        if not cap.isOpened():
            self.camera_failed.emit("No se pudo abrir la cámara (índice 0).")
            return
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._running = True
        try:
            while self._running:
                ok, frame = cap.read()
                if not ok:
                    self.msleep(40)
                    continue
                self.frame_ready.emit(cv2.flip(frame, 1))
                self.msleep(33)
        finally:
            try:
                cap.release()
            except Exception:
                pass

    def stop(self):
        self._running = False
        self.wait(2000)


def _bgr_to_qpixmap(frame: np.ndarray, max_w: int) -> QPixmap:
    h, w = frame.shape[:2]
    if w > max_w:
        scale = max_w / w
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = frame.shape[:2]
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = QImage(rgb.data, w, h, w * 3, QImage.Format_RGB888).copy()
    return QPixmap.fromImage(img)


class EnrollmentWindow(QDialog):
    """Diálogo modal para enrolar un nuevo empleado en Supabase."""

    enrolled = pyqtSignal(str)  # empleado_id (uuid)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Registrar nuevo empleado")
        self.setModal(True)
        self.setMinimumSize(QSize(880, 560))
        self.setStyleSheet(_QSS)

        self._captured_frames: List[np.ndarray] = []
        self._current_frame: Optional[np.ndarray] = None
        self._capturing = False
        self._capture_timer: Optional[QTimer] = None
        self._task = None  # mantener referencia al QRunnable mientras corre

        self._build_ui()
        self._start_camera()

    # ── UI ───────────────────────────────────────────────────────────────────
    def _build_ui(self):
        root = QHBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(20)

        # Columna cámara
        cam_col = QVBoxLayout()
        cam_col.setSpacing(10)
        self._video_label = QLabel("Iniciando cámara…")
        self._video_label.setObjectName("video")
        self._video_label.setAlignment(Qt.AlignCenter)
        self._video_label.setMinimumSize(QSize(480, 360))
        self._video_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        cam_col.addWidget(self._video_label)

        # Tira de miniaturas
        thumbs_row = QHBoxLayout()
        thumbs_row.setSpacing(6)
        self._thumb_labels: List[QLabel] = []
        for _ in range(TARGET_FRAMES):
            lbl = QLabel()
            lbl.setObjectName("thumb")
            lbl.setFixedSize(QSize(70, 56))
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setText("·")
            thumbs_row.addWidget(lbl)
            self._thumb_labels.append(lbl)
        thumbs_row.addStretch()
        cam_col.addLayout(thumbs_row)

        self._progress = QProgressBar()
        self._progress.setMinimum(0)
        self._progress.setMaximum(TARGET_FRAMES)
        self._progress.setValue(0)
        self._progress.setFormat("0 / %m frames")
        cam_col.addWidget(self._progress)

        root.addLayout(cam_col, 3)

        # Columna formulario
        form_col = QVBoxLayout()
        form_col.setSpacing(12)

        title = QLabel("Nuevo empleado")
        title.setObjectName("title")
        form_col.addWidget(title)

        subtitle = QLabel("Captura el rostro y completa los datos. Se subirá a la nube al guardar.")
        subtitle.setObjectName("subtitle")
        subtitle.setWordWrap(True)
        form_col.addWidget(subtitle)

        form = QGridLayout()
        form.setSpacing(8)

        def _input(placeholder: str) -> QLineEdit:
            e = QLineEdit()
            e.setPlaceholderText(placeholder)
            e.setObjectName("input")
            return e

        self._in_nombre = _input("Ej. Juan")
        self._in_apellido = _input("Ej. Pérez García")
        self._in_codigo = _input("Ej. EMP-1024 (opcional)")
        self._in_puesto = _input("Ej. Cajero (opcional)")

        labels = ["Nombre*", "Apellidos*", "Código de empleado", "Puesto"]
        widgets = [self._in_nombre, self._in_apellido, self._in_codigo, self._in_puesto]
        for row, (label_text, widget) in enumerate(zip(labels, widgets)):
            lbl = QLabel(label_text)
            lbl.setObjectName("label")
            form.addWidget(lbl, row, 0)
            form.addWidget(widget, row, 1)
        form_col.addLayout(form)

        self._status = QLabel("")
        self._status.setObjectName("status")
        self._status.setWordWrap(True)
        form_col.addWidget(self._status)

        form_col.addStretch()

        btn_row = QHBoxLayout()
        btn_row.setSpacing(10)
        self._btn_capture = QPushButton("Capturar rostro")
        self._btn_capture.setObjectName("primary")
        self._btn_capture.clicked.connect(self._on_capture_clicked)

        self._btn_reset = QPushButton("Reiniciar")
        self._btn_reset.setObjectName("secondary")
        self._btn_reset.clicked.connect(self._reset_capture)
        self._btn_reset.setEnabled(False)

        btn_row.addWidget(self._btn_capture)
        btn_row.addWidget(self._btn_reset)
        form_col.addLayout(btn_row)

        bottom_row = QHBoxLayout()
        bottom_row.setSpacing(10)
        self._btn_cancel = QPushButton("Cancelar")
        self._btn_cancel.clicked.connect(self.reject)
        self._btn_save = QPushButton("Guardar y subir")
        self._btn_save.setObjectName("success")
        self._btn_save.setEnabled(False)
        self._btn_save.clicked.connect(self._on_save_clicked)
        bottom_row.addWidget(self._btn_cancel)
        bottom_row.addWidget(self._btn_save)
        form_col.addLayout(bottom_row)

        # Separador visual
        sep = QFrame()
        sep.setFrameShape(QFrame.VLine)
        sep.setObjectName("sep")
        root.addWidget(sep)

        wrap = QWidget()
        wrap.setLayout(form_col)
        root.addWidget(wrap, 2)

    # ── Cámara ───────────────────────────────────────────────────────────────
    def _start_camera(self):
        self._cam = _CameraThread(index=0)
        self._cam.frame_ready.connect(self._on_frame)
        self._cam.camera_failed.connect(self._on_camera_failed)
        self._cam.start()

    def _on_frame(self, frame: np.ndarray):
        self._current_frame = frame
        pix = _bgr_to_qpixmap(frame, self._video_label.width() or 480)
        self._video_label.setPixmap(pix)

    def _on_camera_failed(self, msg: str):
        self._video_label.setText(msg)
        self._set_status(msg, error=True)
        self._btn_capture.setEnabled(False)

    # ── Captura múltiple ─────────────────────────────────────────────────────
    def _on_capture_clicked(self):
        if self._capturing:
            return
        if self._current_frame is None:
            self._set_status("La cámara aún no está lista", error=True)
            return
        self._captured_frames = []
        for lbl in self._thumb_labels:
            lbl.clear()
            lbl.setText("·")
        self._progress.setValue(0)
        self._set_status(f"Capturando {TARGET_FRAMES} frames…")
        self._capturing = True
        self._btn_capture.setEnabled(False)
        self._btn_save.setEnabled(False)
        self._btn_reset.setEnabled(False)

        self._capture_timer = QTimer(self)
        self._capture_timer.setInterval(CAPTURE_INTERVAL_MS)
        self._capture_timer.timeout.connect(self._capture_one)
        self._capture_timer.start()
        self._capture_one()  # primera muestra inmediata

    def _capture_one(self):
        if self._current_frame is None:
            return
        idx = len(self._captured_frames)
        if idx >= TARGET_FRAMES:
            self._capture_timer.stop()
            self._capturing = False
            self._btn_capture.setEnabled(True)
            self._btn_reset.setEnabled(True)
            self._btn_save.setEnabled(True)
            self._set_status("Captura lista. Revisa las miniaturas y guarda.")
            return
        snap = self._current_frame.copy()
        self._captured_frames.append(snap)
        thumb = _bgr_to_qpixmap(snap, 70)
        self._thumb_labels[idx].setPixmap(thumb)
        self._progress.setValue(idx + 1)

    def _reset_capture(self):
        if self._capture_timer:
            self._capture_timer.stop()
        self._captured_frames = []
        for lbl in self._thumb_labels:
            lbl.clear()
            lbl.setText("·")
        self._progress.setValue(0)
        self._capturing = False
        self._btn_capture.setEnabled(True)
        self._btn_reset.setEnabled(False)
        self._btn_save.setEnabled(False)
        self._set_status("")

    # ── Guardado ─────────────────────────────────────────────────────────────
    def _on_save_clicked(self):
        nombre = self._in_nombre.text().strip()
        apellido = self._in_apellido.text().strip()
        if not nombre or not apellido:
            self._set_status("Nombre y apellidos son obligatorios", error=True)
            return
        if len(self._captured_frames) < TARGET_FRAMES:
            self._set_status(
                f"Necesitamos {TARGET_FRAMES} capturas (tienes {len(self._captured_frames)})",
                error=True,
            )
            return

        from services.enrollment_service import get_enrollment_service
        from utils.station_manager import StationInfo

        service = get_enrollment_service()
        # Conectar una sola vez por instancia de ventana
        try:
            service.enrolled.disconnect()
        except TypeError:
            pass
        try:
            service.failed.disconnect()
        except TypeError:
            pass
        service.enrolled.connect(self._on_enroll_success)
        service.failed.connect(self._on_enroll_failure)

        self._set_status("Subiendo a la nube…")
        self._btn_save.setEnabled(False)
        self._btn_cancel.setEnabled(False)
        self._btn_reset.setEnabled(False)
        self._btn_capture.setEnabled(False)

        service.enroll_async(
            nombre=nombre,
            apellido=apellido,
            employee_code=self._in_codigo.text().strip() or None,
            puesto=self._in_puesto.text().strip() or None,
            sucursal_id=StationInfo.sucursal_id,
            frames=list(self._captured_frames),
        )

    def _on_enroll_success(self, result):
        self._set_status(
            f"Empleado registrado · {result.frames_validos}/{result.frames_totales} frames válidos",
            success=True,
        )
        self.enrolled.emit(result.empleado_id)
        QTimer.singleShot(1500, self.accept)

    def _on_enroll_failure(self, error: str):
        self._set_status(error, error=True)
        self._btn_save.setEnabled(True)
        self._btn_cancel.setEnabled(True)
        self._btn_reset.setEnabled(True)
        self._btn_capture.setEnabled(True)

    # ── Helpers ──────────────────────────────────────────────────────────────
    def _set_status(self, text: str, error: bool = False, success: bool = False):
        self._status.setText(text)
        if error:
            self._status.setProperty("kind", "error")
        elif success:
            self._status.setProperty("kind", "success")
        else:
            self._status.setProperty("kind", "")
        # forzar refresh del stylesheet
        self._status.style().unpolish(self._status)
        self._status.style().polish(self._status)

    def closeEvent(self, ev):
        try:
            if self._capture_timer:
                self._capture_timer.stop()
            self._cam.stop()
        except Exception:
            pass
        super().closeEvent(ev)


_QSS = """
QDialog {
    background: #0b0f1a;
    color: #e2e8f0;
}
QLabel#title {
    font-size: 20px;
    font-weight: 700;
    color: #f8fafc;
}
QLabel#subtitle {
    font-size: 12px;
    color: #94a3b8;
}
QLabel#label {
    font-size: 12px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QLabel#video {
    background: #020611;
    border: 1px solid #1e293b;
    border-radius: 12px;
    color: #475569;
    font-size: 14px;
}
QLabel#thumb {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 6px;
    color: #475569;
    font-size: 16px;
}
QLabel#status {
    font-size: 12px;
    color: #94a3b8;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.6);
    min-height: 18px;
}
QLabel#status[kind="error"] {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.12);
}
QLabel#status[kind="success"] {
    color: #86efac;
    background: rgba(34, 197, 94, 0.12);
}
QFrame#sep {
    color: #1e293b;
}
QLineEdit#input {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 8px 10px;
    color: #f1f5f9;
    font-size: 13px;
}
QLineEdit#input:focus {
    border-color: #3b82f6;
}
QProgressBar {
    border: 1px solid #1e293b;
    border-radius: 8px;
    background: #0f172a;
    color: #e2e8f0;
    text-align: center;
    height: 18px;
}
QProgressBar::chunk {
    background: #3b82f6;
    border-radius: 7px;
}
QPushButton {
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
}
QPushButton:hover { background: #283447; }
QPushButton:disabled { color: #64748b; background: #111827; }
QPushButton#primary {
    background: #2563eb;
    border-color: #1d4ed8;
    color: white;
}
QPushButton#primary:hover { background: #1d4ed8; }
QPushButton#success {
    background: #16a34a;
    border-color: #15803d;
    color: white;
}
QPushButton#success:hover { background: #15803d; }
QPushButton#secondary {
    background: #0f172a;
}
"""


__all__ = ["EnrollmentWindow"]
