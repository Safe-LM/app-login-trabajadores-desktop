"""
Reconocimiento facial usando OpenCV DNN (SFace + YuNet).

Usa modelos neuronales pre-entrenados del OpenCV Zoo para generar
embeddings faciales de 128 dimensiones, comparando con coseno.
Compatible con encodings v3 (SFace).
"""

import cv2
import numpy as np
from pathlib import Path
import pickle
import json
import logging
from typing import Optional, Tuple, Dict, List
from collections import defaultdict

logger = logging.getLogger(__name__)


class OpenCVFaceRecognizer:
    """Reconocedor facial con SFace embeddings y voting."""

    def __init__(self, database_dir: Path):
        self.database_dir = database_dir
        self.encodings_file = database_dir / "face_encodings_opencv.pkl"
        self.metadata_file = database_dir / "json" / "employees_db.json"
        self.models_dir = database_dir.parent / "models"

        self.encodings: List[np.ndarray] = []
        self.employee_ids: List[int] = []
        self.employee_info: Dict[int, Dict] = {}
        self.loaded = False
        self._is_augmented = False
        self._version = 1

        # Modelos DNN
        self._detector: Optional[cv2.FaceDetectorYN] = None
        self._recognizer: Optional[cv2.FaceRecognizerSF] = None
        self._dnn_available = False

        # Haar cascade como fallback
        self._cascade = None
        try:
            self._cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
        except Exception:
            pass

        self._init_dnn()

    def _init_dnn(self):
        """Inicializar modelos DNN de detección y reconocimiento."""
        yunet_path = self.models_dir / "face_detection_yunet_2023mar.onnx"
        sface_path = self.models_dir / "face_recognition_sface_2021dec.onnx"

        if not yunet_path.exists() or not sface_path.exists():
            logger.warning(
                "Modelos DNN no encontrados en 'models/'. Ejecuta train_face_recognition_opencv.py"
            )
            return

        try:
            self._detector = cv2.FaceDetectorYN.create(str(yunet_path), "", (320, 320))
            self._detector.setScoreThreshold(0.6)
            self._recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
            self._dnn_available = True
            logger.info("Modelos DNN cargados (YuNet + SFace)")
        except Exception as e:
            logger.warning(f"Error cargando modelos DNN: {e}")

    def load_encodings(self) -> bool:
        """Cargar encodings y metadatos."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    for emp in json.load(f):
                        nombre_completo = emp.get("nombre", "").strip()
                        parts = nombre_completo.split()
                        if len(parts) >= 3:
                            emp["apellido"] = f"{parts[0]} {parts[1]}"
                            emp["nombre"] = " ".join(parts[2:])
                        elif len(parts) == 2:
                            emp["apellido"] = parts[0]
                            emp["nombre"] = parts[1]
                        else:
                            emp["apellido"] = ""
                        self.employee_info[emp["employee_id"]] = emp
            except Exception as e:
                logger.warning(f"Error cargando metadatos: {e}")

        if not self.encodings_file.exists():
            logger.warning(
                "No se encontraron encodings. Ejecuta train_face_recognition_opencv.py"
            )
            return False

        try:
            with open(self.encodings_file, "rb") as f:
                data = pickle.load(f)  # nosec
            self.encodings = data.get("encodings", [])
            self.employee_ids = data.get("employee_ids", [])
            self._is_augmented = data.get("augmented", False)
            self._version = data.get("version", 1)

            unique = len(set(self.employee_ids))
            ratio = len(self.encodings) / max(unique, 1)
            logger.info(
                f"Encodings cargados: {len(self.encodings)} "
                f"({unique} empleados, ~{ratio:.0f}/persona, v{self._version})"
            )
            self.loaded = True
            return True
        except Exception as e:
            logger.warning(f"Error cargando encodings: {e}")
            return False

    def _detect_face_dnn(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Detectar rostro con YuNet (más preciso, con landmarks)."""
        if not self._dnn_available or self._detector is None:
            return None
        h, w = frame.shape[:2]
        self._detector.setInputSize((w, h))
        _, faces = self._detector.detect(frame)
        if faces is None or len(faces) == 0:
            return None
        return faces[np.argmax(faces[:, -1])]

    def _detect_face_cascade(
        self, frame: np.ndarray
    ) -> Optional[Tuple[int, int, int, int]]:
        """Fallback: Haar Cascade."""
        if self._cascade is None:
            return None
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
        if len(faces) == 0:
            return None
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        return (x, y, x + w, y + h)

    def _get_embedding(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Obtener embedding facial de un frame."""
        if not self._dnn_available:
            return None

        face_info = self._detect_face_dnn(frame)

        if face_info is None:
            # Fallback: detectar con cascade, recortar, re-intentar con YuNet
            bbox = self._detect_face_cascade(frame)
            if bbox is None:
                return None
            x1, y1, x2, y2 = bbox
            pad = int(max(x2 - x1, y2 - y1) * 0.2)
            y1c = max(0, y1 - pad)
            y2c = min(frame.shape[0], y2 + pad)
            x1c = max(0, x1 - pad)
            x2c = min(frame.shape[1], x2 + pad)
            crop = frame[y1c:y2c, x1c:x2c]
            face_info = self._detect_face_dnn(crop)
            if face_info is None:
                return None
            aligned = self._recognizer.alignCrop(crop, face_info)
        else:
            aligned = self._recognizer.alignCrop(frame, face_info)

        emb = self._recognizer.feature(aligned)
        return emb.flatten()

    def recognize(self, frame: np.ndarray) -> Tuple[bool, float, Optional[Dict]]:
        """Reconocer empleado.

        Para v3 (SFace): usa cosine similarity del propio OpenCV.
        Con augmentation: voting top-K por empleado.
        """
        if not self.loaded and not self.load_encodings():
            return False, 0.0, None

        if not self.encodings:
            return False, 0.0, None

        try:
            query_emb = self._get_embedding(frame)
            if query_emb is None:
                return False, 0.0, None

            # Calcular similitud con todos los encodings almacenados
            sims = []
            for idx, stored in enumerate(self.encodings):
                if self._dnn_available and self._recognizer is not None:
                    score = self._recognizer.match(
                        query_emb.reshape(1, -1),
                        stored.reshape(1, -1),
                        cv2.FaceRecognizerSF_FR_COSINE,
                    )
                else:
                    dot = np.dot(query_emb, stored)
                    na = np.linalg.norm(query_emb) + 1e-7
                    nb = np.linalg.norm(stored) + 1e-7
                    score = float(dot / (na * nb))
                sims.append((score, self.employee_ids[idx]))

            if self._is_augmented:
                emp_sims = defaultdict(list)
                for sim, eid in sims:
                    emp_sims[eid].append(sim)

                emp_scores = {}
                for eid, sim_list in emp_sims.items():
                    top_k = sorted(sim_list, reverse=True)[:5]
                    emp_scores[eid] = np.mean(top_k)

                best_eid = max(emp_scores, key=emp_scores.get)
                best_score = emp_scores[best_eid]

                sorted_scores = sorted(emp_scores.values(), reverse=True)
                second_best = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
                gap = best_score - second_best
            else:
                sims.sort(reverse=True, key=lambda x: x[0])
                best_score, best_eid = sims[0]
                second_best = sims[1][0] if len(sims) > 1 else 0.0
                gap = best_score - second_best

            # SFace cosine: >0.363 es match según OpenCV docs; usamos >0.40 para seguridad
            # Convertimos a porcentaje (0.40 -> ~85%, 0.50 -> ~90%, 0.60 -> ~95%)
            threshold = 0.40
            min_gap = 0.03

            if best_score >= threshold and gap >= min_gap:
                display_conf = min(0.99, 0.70 + best_score * 0.50)
                info = self.employee_info.get(
                    best_eid,
                    {
                        "employee_id": best_eid,
                        "nombre": f"Empleado {best_eid}",
                        "zona": "N/A",
                        "sucursal": "N/A",
                        "puesto": "N/A",
                    },
                )
                return True, display_conf, info

            return False, 0.0, None

        except Exception as e:
            logger.error(f"Error en reconocimiento: {e}", exc_info=True)
            return False, 0.0, None

    def detect_face(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """Detectar rostro (compatible con interfaz existente)."""
        face_info = self._detect_face_dnn(frame)
        if face_info is not None:
            x, y, w, h = (
                int(face_info[0]),
                int(face_info[1]),
                int(face_info[2]),
                int(face_info[3]),
            )
            return (x, y, x + w, y + h)
        return self._detect_face_cascade(frame)


# --- Singleton global ---
_opencv_recognizer = None


def get_opencv_recognizer(
    database_dir: Optional[Path] = None,
) -> Optional[OpenCVFaceRecognizer]:
    global _opencv_recognizer
    if _opencv_recognizer is None:
        if database_dir is None:
            # Apuntar a database_fotos/ en la raíz del proyecto
            PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
            database_dir = PROJECT_ROOT / "database_fotos"
        _opencv_recognizer = OpenCVFaceRecognizer(database_dir)
        if not _opencv_recognizer.load_encodings():
            return None
    return _opencv_recognizer


def recognize_opencv(frame: np.ndarray) -> Tuple[bool, float, Optional[Dict]]:
    recognizer = get_opencv_recognizer()
    if recognizer is None:
        return False, 0.0, None
    return recognizer.recognize(frame)
