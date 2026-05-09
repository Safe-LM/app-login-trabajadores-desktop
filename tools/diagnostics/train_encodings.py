"""
Train Face Encodings - Genera face_encodings_opencv.pkl desde las fotos descargadas.

Uso:
    python train_encodings.py                          # Genera desde cache local
    python train_encodings.py --cache-dir ./data/cache/empresa_id
    python train_encodings.py --photos-dir ./database_fotos/photos

Este script:
1. Lee las fotos del directorio cache/photos/
2. Detecta rostros con YuNet
3. Genera embeddings con SFace
4. Guarda en face_encodings_opencv.pkl junto con employees.json
"""

import argparse
import json
import logging
import pickle
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── DNN Models ───────────────────────────────────────────────────────────────
class FaceEmbeddingExtractor:
    """Extrae embeddings faciales usando OpenCV DNN (YuNet + SFace)."""

    def __init__(self, models_dir: Optional[Path] = None):
        self._detector: Optional[cv2.FaceDetectorYN] = None
        self._recognizer: Optional[cv2.FaceRecognizerSF] = None
        self._dnn_available = False
        self._cascade = None
        self._init_models(models_dir)

    def _init_models(self, models_dir: Optional[Path]):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent.parent / "models"

        yunet_path = models_dir / "face_detection_yunet_2023mar.onnx"
        sface_path = models_dir / "face_recognition_sface_2021dec.onnx"

        if not yunet_path.exists() or not sface_path.exists():
            logger.warning(f"Modelos DNN no encontrados en {models_dir}")
            logger.warning("Ejecuta: python download_models.py")
            return

        try:
            self._detector = cv2.FaceDetectorYN.create(str(yunet_path), "", (320, 320))
            self._detector.setScoreThreshold(0.6)
            self._recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")
            self._dnn_available = True
            logger.info("Modelos DNN cargados (YuNet + SFace)")
        except Exception as e:
            logger.error(f"Error cargando modelos DNN: {e}")

    def is_available(self) -> bool:
        return self._dnn_available

    def _detect_face_dnn(self, frame: np.ndarray) -> Optional[np.ndarray]:
        if not self._dnn_available or self._detector is None:
            return None
        h, w = frame.shape[:2]
        self._detector.setInputSize((w, h))
        _, faces = self._detector.detect(frame)
        if faces is None or len(faces) == 0:
            return None
        return faces[np.argmax(faces[:, -1])]

    def _detect_face_cascade(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        if self._cascade is None:
            try:
                cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
                self._cascade = cv2.CascadeClassifier(cascade_path)
            except Exception:
                return None
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
        if len(faces) == 0:
            return None
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        return (x, y, x + w, y + h)

    def get_embedding(self, image_path: Path) -> Optional[np.ndarray]:
        """Extrae embedding de 128D desde una imagen."""
        if not self._dnn_available:
            return None

        try:
            frame = cv2.imread(str(image_path))
            if frame is None:
                logger.warning(f"No se pudo leer imagen: {image_path}")
                return None

            face_info = self._detect_face_dnn(frame)

            if face_info is None:
                # Fallback cascade
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
                self._detector.setInputSize((x2c - x1c, y2c - y1c))
                success, faces_c = self._detector.detect(crop)
                if success and faces_c is not None and len(faces_c) > 0:
                    face_info = faces_c[np.argmax(faces_c[:, -1])]
                else:
                    return None

            aligned = self._recognizer.alignCrop(frame, face_info)
            embedding = self._recognizer.feature(aligned)
            return embedding.flatten()

        except Exception as e:
            logger.debug(f"Error extrayendo embedding de {image_path}: {e}")
            return None


def find_photos(photos_dir: Path) -> List[Tuple[str, Path]]:
    """Encuentra todas las imágenes en un directorio."""
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    photos = []
    for ext in extensions:
        photos.extend(photos_dir.glob(f"*{ext}"))
        photos.extend(photos_dir.glob(f"*{ext.upper()}"))
    return [(p.stem, p) for p in sorted(set(photos))]


def load_employees_json(employees_path: Path) -> Dict:
    """Carga el archivo employees.json del cache."""
    if not employees_path.exists():
        logger.warning(f"employees.json no encontrado: {employees_path}")
        return {}

    with open(employees_path, "r", encoding="utf-8") as f:
        return {emp["id"]: emp for emp in json.load(f)}


def generate_encodings(
    photos_dir: Path,
    employees_json: Path,
    output_path: Path,
    extractor: FaceEmbeddingExtractor,
) -> Tuple[int, int]:
    """
    Genera encodings desde las fotos.

    Returns:
        (total_fotos, fotos_con_rostro)
    """
    employees = load_employees_json(employees_json)
    photos = find_photos(photos_dir)

    if not photos:
        logger.warning(f"No se encontraron fotos en {photos_dir}")
        return 0, 0

    encodings: List[np.ndarray] = []
    employee_ids: List[str] = []
    employee_info: Dict = {}

    total = len(photos)
    ok = 0

    logger.info(f"Procesando {total} fotos...")

    for idx, (photo_stem, photo_path) in enumerate(photos):
        emp_id = photo_stem
        emp_data = employees.get(emp_id, {})
        nombre = emp_data.get("nombre", "Unknown")
        apellido = emp_data.get("apellido", "")
        logger.info(f"[{idx+1}/{total}] {nombre} {apellido}...")

        emb = extractor.get_embedding(photo_path)

        if emb is not None:
            encodings.append(emb)
            employee_ids.append(emp_id)
            employee_info[emp_id] = {
                "employee_id": emp_id,
                "nombre": nombre,
                "apellido": apellido,
                "puesto": emp_data.get("puesto", ""),
                "sucursal": emp_data.get("sucursal_nombre", ""),
            }
            ok += 1
            logger.info(f"  ✓ Embedding generado ({emb.shape})")
        else:
            logger.warning(f"  ✗ No se detectó rostro")

    if not encodings:
        logger.error("No se generaron encodings. Verifica las fotos y modelos.")
        return total, 0

    # Guardar pickle
    data = {
        "encodings": encodings,
        "employee_ids": employee_ids,
        "augmented": False,
        "version": 3,
    }

    with open(output_path, "wb") as f:
        pickle.dump(data, f)

    logger.info(f"✓ Encodings guardados: {ok}/{total} fotos procesadas")
    logger.info(f"  Archivo: {output_path}")
    logger.info(f"  Empleados únicos: {len(set(employee_ids))}")

    # Guardar employees_info.json para uso del recognizer
    info_path = output_path.parent / "employees_info.json"
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(
            [{"id": eid, **emp_info} for eid, emp_info in employee_info.items()],
            f,
            ensure_ascii=False,
            indent=2,
        )

    return total, ok


def main():
    parser = argparse.ArgumentParser(description="Genera face encodings desde fotos")
    parser.add_argument(
        "--cache-dir",
        type=Path,
        help="Directorio de cache (contiene photos/ y employees.json)",
    )
    parser.add_argument(
        "--photos-dir",
        type=Path,
        help="Directorio con fotos de empleados",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Ruta de salida para face_encodings_opencv.pkl",
    )
    parser.add_argument(
        "--models-dir",
        type=Path,
        help="Directorio con modelos ONNX",
    )
    parser.add_argument(
        "--employees-json",
        type=Path,
        help="Ruta a employees.json (por defecto: cache_dir/employees.json)",
    )
    args = parser.parse_args()

    # Determinar directorios
    if args.cache_dir:
        cache_dir = args.cache_dir
        photos_dir = args.photos_dir or (cache_dir / "photos")
        employees_json = args.employees_json or (cache_dir / "employees.json")
        output_path = args.output or (cache_dir / "face_encodings_opencv.pkl")
    elif args.photos_dir:
        photos_dir = args.photos_dir
        employees_json = args.employees_json or photos_dir.parent / "employees.json"
        output_path = args.output or (photos_dir.parent / "face_encodings_opencv.pkl")
    else:
        # Default: buscar en estructura típica
        project_root = Path(__file__).resolve().parent.parent.parent
        cache_dirs = list((project_root / "data" / "cache").glob("*"))
        if cache_dirs:
            cache_dir = cache_dirs[0]
            photos_dir = cache_dir / "photos"
            employees_json = cache_dir / "employees.json"
            output_path = cache_dir / "face_encodings_opencv.pkl"
        else:
            # Fallback a database_fotos
            photos_dir = project_root / "database_fotos" / "photos"
            employees_json = project_root / "database_fotos" / "json" / "employees_db.json"
            output_path = project_root / "database_fotos" / "face_encodings_opencv.pkl"

    models_dir = args.models_dir or (Path(__file__).resolve().parent.parent.parent / "station" / "models")

    print()
    logger.info("=" * 60)
    logger.info("SafeLink - Generador de Encodings Faciales")
    logger.info("=" * 60)
    logger.info(f"  Fotos:    {photos_dir}")
    logger.info(f"  Empleados: {employees_json}")
    logger.info(f"  Output:   {output_path}")
    logger.info(f"  Modelos:  {models_dir}")
    logger.info("=" * 60)
    print()

    # Verificar que existe photos_dir
    if not photos_dir.exists():
        logger.error(f"Directorio de fotos no existe: {photos_dir}")
        sys.exit(1)

    # Inicializar extractor
    extractor = FaceEmbeddingExtractor(models_dir)
    if not extractor.is_available():
        logger.error("Modelos DNN no disponibles. Ejecuta download_models.py primero.")
        sys.exit(1)

    # Generar encodings
    total, ok = generate_encodings(
        photos_dir=photos_dir,
        employees_json=employees_json,
        output_path=output_path,
        extractor=extractor,
    )

    print()
    if ok > 0:
        logger.info("✓ Proceso completado exitosamente")
    else:
        logger.error("✗ Fallo al generar encodings")
        sys.exit(1)


if __name__ == "__main__":
    main()