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


def _find_models_dir(start: Path) -> Path:
    """
    Resuelve la ruta de los modelos DNN (YuNet + SFace).

    En orden de prioridad:
      1. writable_root() / 'models' — APPDATA en .exe instalado.
         Modelos descargados/copiados al primer arranque.
      2. bundled_models_root() — modelos que vienen pre-empaquetados en
         el .exe (PyInstaller los pone aqui via spec.datas).
      3. Buscar subiendo en la jerarquia desde `start` — fallback para
         dev local donde station/models/ vive 3-4 niveles arriba del cache.
      4. start.parent / 'models' — path "esperado", caller validara.

    Bug previo: solo usaba (3), lo que en el .exe instalado encontraba
    APPDATA\\Safe Link Station\\models (creado vacio por models_root()
    en paths.py) y se quedaba ahi sin nunca chequear el bundle. Como
    los .onnx solo viven en el bundle, dnn_available quedaba False y
    el reconocimiento entero se rompia silenciosamente.
    """
    # 1. Ruta escribible (puede tener modelos copiados/descargados)
    try:
        from utils.paths import models_root, bundled_models_root

        writable = models_root()
        if writable.exists() and any(writable.glob("*.onnx")):
            return writable

        # 2. Bundle PyInstaller (read-only pero contiene los modelos)
        bundled = bundled_models_root()
        if bundled.exists() and any(bundled.glob("*.onnx")):
            return bundled
    except Exception:
        # paths.py podria no estar disponible en algun contexto de test
        pass

    # 3. Busqueda jerarquica clasica (compat dev local)
    p = start.resolve()
    for _ in range(6):
        candidate = p / "models"
        if candidate.exists() and any(candidate.glob("*.onnx")):
            return candidate
        if p.parent == p:
            break
        p = p.parent

    # 4. Path "esperado" — caller validara existencia
    return start.parent / "models"


class OpenCVFaceRecognizer:
    """Reconocedor facial con SFace embeddings y voting."""

    def __init__(self, database_dir: Path):
        self.database_dir = database_dir
        self.encodings_file = database_dir / "face_encodings_opencv.pkl"
        self.metadata_file = database_dir / "json" / "employees_db.json"
        # database_dir es station/data/cache/<empresa_id>/ — modelos viven en station/models/
        # Buscamos hacia arriba hasta encontrar la carpeta 'models'
        self.models_dir = _find_models_dir(database_dir)

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

        # Haar cascade como fallback de deteccion. En PyInstaller bundle
        # cv2.data.haarcascades puede apuntar a una ruta donde el XML no
        # esta empaquetado — CascadeClassifier() no lanza error pero crea
        # un objeto vacio que peta al usarlo ("Assertion failed: !empty()").
        # Validamos .empty() y descartamos el cascade si esta vacio para
        # que _get_embedding caiga directo a YuNet sin intentar el fallback.
        self._cascade = None
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            c = cv2.CascadeClassifier(cascade_path)
            if not c.empty():
                self._cascade = c
            else:
                logger.warning(
                    f"Haar cascade vacio ({cascade_path}) — fallback desactivado, "
                    f"YuNet manejara toda la deteccion."
                )
        except Exception as e:
            logger.warning(f"Haar cascade no disponible: {e}")

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
                        # El JSON puede usar "employee_id" (formato viejo) o "id" (formato sync_manager).
                        # Normalizamos a employee_id.
                        emp_id = emp.get("employee_id") or emp.get("id")
                        if not emp_id:
                            continue
                        emp["employee_id"] = emp_id

                        # Si el JSON ya tiene apellido separado (formato sync), no recortamos el nombre.
                        if not emp.get("apellido"):
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
                        self.employee_info[emp_id] = emp
            except Exception as e:
                logger.warning(f"Error cargando metadatos: {e}")

        if not self.encodings_file.exists():
            logger.info("No se encontraron encodings previos (sistema nuevo)")
            return True

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
        """Fallback: Haar Cascade. Defensa profunda: si por alguna razon
        el cascade quedo vacio post-init, capturamos el error en lugar de
        propagar el assertion failure de OpenCV."""
        if self._cascade is None:
            return None
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self._cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
            if len(faces) == 0:
                return None
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            return (x, y, x + w, y + h)
        except cv2.error:
            # Cascade en estado invalido — desactivar definitivamente
            self._cascade = None
            return None

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

        # A4: Quality gate del frame. Rechaza frames basura ANTES de
        # invocar el modelo. Los umbrales estan calibrados para frames
        # de webcam que YA pasaron por resize a 480px + CLAHE en el
        # pipeline del dashboard — ambos pasos suavizan la imagen y
        # bajan el laplaciano respecto a una foto cruda.
        #
        # - mean_brightness <20 o >235: cuarto a oscuras / lente tapada
        #   / sobreexposicion. El modelo procesaria ruido.
        # - std_brightness <6: frame uniforme (negro, congelado).
        # - laplacian_var <15: solo bloqueamos blur extremo. Una webcam
        #   USB tipica en kiosko, tras resize+CLAHE, da lap_var ~25-50
        #   con una cara nitida — un umbral de 40 rechazaba TODOS los
        #   intentos legitimos.
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            mean_brightness = float(gray.mean())
            std_brightness  = float(gray.std())
            laplacian_var   = float(cv2.Laplacian(gray, cv2.CV_64F).var())

            if mean_brightness < 20 or mean_brightness > 235:
                return False, 0.0, None
            if std_brightness < 6:
                return False, 0.0, None
            if laplacian_var < 15:
                return False, 0.0, None
        except Exception:
            # Si la metrica falla, no bloqueamos — preferimos procesar
            # de mas a perder un fichaje legitimo.
            pass

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

            # SFace cosine: >0.363 es match segun docs de OpenCV; usamos
            # >0.40 con gap >=0.03 sobre el segundo mejor.
            threshold = 0.40
            min_gap = 0.03

            if best_score >= threshold and gap >= min_gap:
                # Reportamos cosine RAW (sin inflar). Antes se usaba
                # display_conf = 0.70 + raw*0.50 lo que reportaba 90%
                # cuando el cosine real era 0.40 — mentia al admin y
                # rompia auditoria. Ahora persistimos el valor honesto.
                # La UI puede multiplicar por 100 si quiere "%", pero
                # el valor guardado en BD es el cosine real.
                raw_conf = float(best_score)
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
                # Anadir metadatos para tracking de calidad en BD
                info = {
                    **info,
                    "_score_raw": raw_conf,
                    "_gap": float(gap),
                    "_metodo": "sface_v3",
                    "_embedding_count": int(len(self.encodings) if hasattr(self, "encodings") else 0),
                }
                return True, raw_conf, info

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


def _resolve_default_database_dir() -> Path:
    """Resuelve el database_dir por defecto.

    Prioridad:
      1. StationInfo.empresa_id (caso normal: tras sync exitoso)
      2. database_fotos/ legacy (fallback solo si no hay empresa)

    Esta funcion se llama tanto en get_opencv_recognizer() como en
    reset_opencv_recognizer() para mantener la logica en un solo lugar.
    """
    try:
        from utils.station_manager import StationInfo
        from utils.paths import cache_root

        if StationInfo.empresa_id:
            return cache_root() / StationInfo.empresa_id
    except Exception:
        pass
    STATION_ROOT = Path(__file__).resolve().parent.parent.parent
    return STATION_ROOT.parent / "database_fotos"


def reset_opencv_recognizer() -> None:
    """Fuerza recreacion del singleton en la proxima llamada a
    get_opencv_recognizer(). Llamar despues de un sync exitoso para
    que el recognizer apunte al cache correcto (empresa_id descubierto
    desde el backend, no desde el .env)."""
    global _opencv_recognizer
    _opencv_recognizer = None


def get_opencv_recognizer(
    database_dir: Optional[Path] = None,
) -> Optional[OpenCVFaceRecognizer]:
    """Obtiene el singleton. Si `database_dir` se pasa explicitamente y
    difiere del actual, recrea el singleton (evita el bug donde se
    inicializo con path malo en arranque y nunca se actualizo)."""
    global _opencv_recognizer

    if database_dir is None:
        database_dir = _resolve_default_database_dir()

    # Si ya existe pero apunta a otro directorio, reinicializar
    if _opencv_recognizer is not None:
        try:
            if Path(_opencv_recognizer.database_dir).resolve() != Path(database_dir).resolve():
                logger.info(
                    f"Reinicializando OpenCVFaceRecognizer: "
                    f"{_opencv_recognizer.database_dir} -> {database_dir}"
                )
                _opencv_recognizer = None
        except Exception:
            pass

    if _opencv_recognizer is None:
        _opencv_recognizer = OpenCVFaceRecognizer(database_dir)
        _opencv_recognizer.load_encodings()
    return _opencv_recognizer


def recognize_opencv(frame: np.ndarray) -> Tuple[bool, float, Optional[Dict]]:
    recognizer = get_opencv_recognizer()
    if recognizer is None:
        return False, 0.0, None
    return recognizer.recognize(frame)
