"""
Entrenamiento de reconocimiento facial usando OpenCV DNN (SFace + YuNet).

Usa modelos neuronales pre-entrenados de OpenCV Zoo:
- YuNet: detección de rostros (landmarks + bounding box)
- SFace: embeddings faciales de 128 dimensiones

Genera augmentaciones de cada foto para mayor robustez.

Uso:
    python train_face_recognition_opencv.py
"""

import cv2
import json
import pickle
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Modelos DNN
# ---------------------------------------------------------------------------


def load_face_detector(models_dir: Path) -> Optional[cv2.FaceDetectorYN]:
    """Cargar YuNet para detección de rostros."""
    model_path = str(models_dir / "face_detection_yunet_2023mar.onnx")
    try:
        detector = cv2.FaceDetectorYN.create(model_path, "", (320, 320))
        detector.setScoreThreshold(0.7)
        return detector
    except Exception as e:
        logger.error(f"No se pudo cargar YuNet: {e}")
        return None


def load_face_recognizer(models_dir: Path) -> Optional[cv2.FaceRecognizerSF]:
    """Cargar SFace para embeddings faciales."""
    model_path = str(models_dir / "face_recognition_sface_2021dec.onnx")
    try:
        return cv2.FaceRecognizerSF.create(model_path, "")
    except Exception as e:
        logger.error(f"No se pudo cargar SFace: {e}")
        return None


# ---------------------------------------------------------------------------
# Detección y alineación
# ---------------------------------------------------------------------------


def detect_face(
    image: np.ndarray, detector: cv2.FaceDetectorYN
) -> Optional[np.ndarray]:
    """Detectar rostro con YuNet. Retorna la fila de detección (15 valores)."""
    h, w = image.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        return None
    # Tomar el rostro con mayor score
    best_idx = np.argmax(faces[:, -1])
    return faces[best_idx]


def get_aligned_face(
    image: np.ndarray, face_info: np.ndarray, recognizer: cv2.FaceRecognizerSF
) -> np.ndarray:
    """Alinear rostro usando landmarks (SFace espera rostro alineado)."""
    return recognizer.alignCrop(image, face_info)


def get_embedding(
    aligned_face: np.ndarray, recognizer: cv2.FaceRecognizerSF
) -> np.ndarray:
    """Obtener embedding de 128 dimensiones del rostro alineado."""
    return recognizer.feature(aligned_face)


# ---------------------------------------------------------------------------
# Data augmentation
# ---------------------------------------------------------------------------


def augment_image(image: np.ndarray) -> List[np.ndarray]:
    """Generar variaciones de la imagen para robustez."""
    augmented = [image.copy()]
    h, w = image.shape[:2]

    # Flip horizontal
    augmented.append(cv2.flip(image, 1))

    # Variaciones de brillo
    for alpha, beta in [(1.15, 10), (0.85, -10), (1.0, 30), (1.0, -25)]:
        augmented.append(cv2.convertScaleAbs(image, alpha=alpha, beta=beta))

    # Rotaciones leves
    for angle in [-8, 8]:
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        augmented.append(
            cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        )

    # Ruido leve
    noise = np.random.normal(0, 5, image.shape).astype(np.int16)
    augmented.append(np.clip(image.astype(np.int16) + noise, 0, 255).astype(np.uint8))

    # Blur leve
    augmented.append(cv2.GaussianBlur(image, (3, 3), 0))

    return augmented


# ---------------------------------------------------------------------------
# Entrenamiento
# ---------------------------------------------------------------------------


def main():
    logger.info("=" * 55)
    logger.info("ENTRENAMIENTO - Reconocimiento Facial DNN (SFace)")
    logger.info("=" * 55)

    # base_dir = raíz del proyecto
    base_dir = Path(__file__).resolve().parent
    models_dir = base_dir / "models"
    photos_dir = base_dir / "database_fotos" / "photos"
    json_path = base_dir / "database_fotos" / "json" / "employees_db.json"
    output_file = base_dir / "database_fotos" / "face_encodings_opencv.pkl"

    # Cargar modelos
    detector = load_face_detector(models_dir)
    recognizer = load_face_recognizer(models_dir)
    if detector is None or recognizer is None:
        logger.error("Descarga los modelos ONNX en la carpeta 'models/'")
        return

    if not photos_dir.exists():
        logger.error(f"No se encontro directorio de fotos: {photos_dir}")
        return

    # Cargar DB de empleados
    employee_data: Dict[int, Dict] = {}
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            for emp in json.load(f):
                employee_data[emp["employee_id"]] = emp
    logger.info(f"Empleados en DB: {len(employee_data)}")

    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    image_files = sorted(
        f for f in photos_dir.iterdir() if f.suffix.lower() in image_exts
    )
    logger.info(f"Fotos encontradas: {len(image_files)}")
    logger.info("")

    all_embeddings: List[np.ndarray] = []
    all_ids: List[int] = []
    ok = 0
    fail = 0

    # Cascade como fallback para detección
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    for img_file in image_files:
        # Resolver employee_id
        emp_id = None
        for eid, info in employee_data.items():
            pf = info.get("photo_file", "")
            if img_file.name in pf or pf.endswith(img_file.name):
                emp_id = eid
                break
        if emp_id is None:
            for p in img_file.stem.split("_"):
                if p.isdigit():
                    emp_id = int(p)
                    break
        if emp_id is None:
            emp_id = ok + 1

        image = cv2.imread(str(img_file))
        if image is None:
            fail += 1
            logger.warning(f"No se pudo cargar: {img_file.name}")
            continue

        # Generar augmentaciones de la imagen completa
        variations = augment_image(image)
        emb_count = 0

        for var in variations:
            face_info = detect_face(var, detector)

            if face_info is None:
                # Fallback: Haar Cascade para detectar y recortar
                gray = cv2.cvtColor(var, cv2.COLOR_BGR2GRAY)
                faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))
                if len(faces) > 0:
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    pad = int(max(w, h) * 0.2)
                    y1, y2 = max(0, y - pad), min(var.shape[0], y + h + pad)
                    x1, x2 = max(0, x - pad), min(var.shape[1], x + w + pad)
                    face_crop = var[y1:y2, x1:x2]
                    face_info = detect_face(face_crop, detector)
                    if face_info is not None:
                        aligned = get_aligned_face(face_crop, face_info, recognizer)
                        emb = get_embedding(aligned, recognizer)
                        all_embeddings.append(emb.flatten())
                        all_ids.append(emp_id)
                        emb_count += 1
                continue

            aligned = get_aligned_face(var, face_info, recognizer)
            emb = get_embedding(aligned, recognizer)
            all_embeddings.append(emb.flatten())
            all_ids.append(emp_id)
            emb_count += 1

        if emb_count > 0:
            ok += 1
            name = employee_data.get(emp_id, {}).get("nombre", f"Emp-{emp_id}")
            logger.info(f"  [{ok:3d}] {name} -> {emb_count} embeddings")
        else:
            fail += 1
            logger.warning(f"  FALLO: {img_file.name} (no se detecto rostro)")

    logger.info("")
    logger.info("=" * 55)
    logger.info(f"Empleados procesados: {ok}")
    logger.info(f"Fallidos:             {fail}")
    logger.info(f"Total embeddings:     {len(all_embeddings)}")
    logger.info(
        f"Dimension embedding:  {len(all_embeddings[0]) if all_embeddings else 0}"
    )
    logger.info(f"Embeddings/empleado:  ~{len(all_embeddings) // max(ok, 1)}")
    logger.info("=" * 55)

    if not all_embeddings:
        logger.error("No se generaron embeddings. Verifica las fotos y modelos.")
        return

    data = {
        "encodings": all_embeddings,
        "employee_ids": all_ids,
        "version": 3,
        "augmented": True,
        "features": "sface_128d",
    }
    with open(output_file, "wb") as f:
        pickle.dump(data, f)

    logger.info(f"Guardado en: {output_file}")
    logger.info("")
    logger.info("Ejecuta la app: python main.py")


if __name__ == "__main__":
    main()
