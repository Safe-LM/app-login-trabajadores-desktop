"""
Test de precisión del modelo de reconocimiento facial SFace DNN.

Lee cada foto original de empleados, genera un embedding en tiempo real
y compara contra los embeddings almacenados usando voting (top-5 cosine).
Reporta accuracy global e identifica fallos.

Uso:
    python main_codes/test_accuracy.py
"""
import cv2
import json
import pickle
import numpy as np
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
PHOTOS_DIR = BASE_DIR / "database_fotos" / "photos"
JSON_PATH = BASE_DIR / "database_fotos" / "json" / "employees_db.json"
ENCODINGS_PATH = BASE_DIR / "database_fotos" / "face_encodings_opencv.pkl"


def load_models():
    yunet = cv2.FaceDetectorYN.create(
        str(MODELS_DIR / "face_detection_yunet_2023mar.onnx"), "", (320, 320)
    )
    yunet.setScoreThreshold(0.6)
    sface = cv2.FaceRecognizerSF.create(
        str(MODELS_DIR / "face_recognition_sface_2021dec.onnx"), ""
    )
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    return yunet, sface, cascade


def detect_and_embed(image, yunet, sface, cascade):
    h, w = image.shape[:2]
    yunet.setInputSize((w, h))
    _, faces = yunet.detect(image)

    if faces is not None and len(faces) > 0:
        best = faces[np.argmax(faces[:, -1])]
        aligned = sface.alignCrop(image, best)
        return sface.feature(aligned).flatten()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    rects = cascade.detectMultiScale(gray, 1.1, 4, minSize=(50, 50))
    if len(rects) == 0:
        return None

    x, y, ww, hh = max(rects, key=lambda r: r[2] * r[3])
    pad = int(max(ww, hh) * 0.2)
    y1, y2 = max(0, y - pad), min(h, y + hh + pad)
    x1, x2 = max(0, x - pad), min(w, x + ww + pad)
    crop = image[y1:y2, x1:x2]

    ch, cw = crop.shape[:2]
    yunet.setInputSize((cw, ch))
    _, faces2 = yunet.detect(crop)
    if faces2 is not None and len(faces2) > 0:
        best = faces2[np.argmax(faces2[:, -1])]
        aligned = sface.alignCrop(crop, best)
        return sface.feature(aligned).flatten()

    return None


def main():
    print("=" * 60)
    print("  TEST DE PRECISION - SFace DNN + Voting")
    print("=" * 60)

    yunet, sface, cascade = load_models()

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        employees = {e["employee_id"]: e for e in json.load(f)}

    with open(ENCODINGS_PATH, "rb") as f:
        data = pickle.load(f)
    stored_encs = data["encodings"]
    stored_ids = data["employee_ids"]
    is_augmented = data.get("augmented", False)
    print(f"  Embeddings almacenados: {len(stored_encs)}")
    print(f"  Empleados en DB:       {len(employees)}")
    print(f"  Augmented:             {is_augmented}")
    print()

    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    photos = sorted(f for f in PHOTOS_DIR.iterdir() if f.suffix.lower() in image_exts)

    correct = 0
    wrong = 0
    no_face = 0
    results = []

    for photo in photos:
        real_id = None
        for eid, info in employees.items():
            pf = info.get("photo_file", "")
            if photo.name in pf or pf.endswith(photo.name):
                real_id = eid
                break
        if real_id is None:
            for part in photo.stem.split("_"):
                if part.isdigit():
                    real_id = int(part)
                    break
        if real_id is None:
            continue

        image = cv2.imread(str(photo))
        if image is None:
            no_face += 1
            continue

        query_emb = detect_and_embed(image, yunet, sface, cascade)
        if query_emb is None:
            no_face += 1
            results.append((real_id, None, 0.0, "SIN ROSTRO"))
            continue

        sims = []
        for idx, stored in enumerate(stored_encs):
            score = sface.match(
                query_emb.reshape(1, -1),
                stored.reshape(1, -1),
                cv2.FaceRecognizerSF_FR_COSINE,
            )
            sims.append((score, stored_ids[idx]))

        if is_augmented:
            emp_sims = defaultdict(list)
            for sim, eid in sims:
                emp_sims[eid].append(sim)
            emp_scores = {}
            for eid, sim_list in emp_sims.items():
                top_k = sorted(sim_list, reverse=True)[:5]
                emp_scores[eid] = np.mean(top_k)
            pred_id = max(emp_scores, key=emp_scores.get)
            best_score = emp_scores[pred_id]
        else:
            sims.sort(reverse=True, key=lambda x: x[0])
            best_score, pred_id = sims[0]

        if pred_id == real_id:
            correct += 1
            status = "OK"
        else:
            wrong += 1
            status = "FALLO"

        results.append((real_id, pred_id, best_score, status))
        name = employees.get(real_id, {}).get("nombre", f"Emp-{real_id}")
        pred_name = employees.get(pred_id, {}).get("nombre", f"Emp-{pred_id}")
        mark = "OK" if status == "OK" else "XX"
        print(f"  {mark} [{real_id:3d}] {name:<25s} -> pred={pred_id:3d} ({pred_name}) score={best_score:.4f}")

    total = correct + wrong + no_face
    accuracy = correct / max(correct + wrong, 1) * 100

    print()
    print("=" * 60)
    print(f"  RESULTADOS")
    print(f"  Total fotos:     {total}")
    print(f"  Correctos:       {correct}")
    print(f"  Incorrectos:     {wrong}")
    print(f"  Sin rostro:      {no_face}")
    print(f"  ACCURACY:        {accuracy:.1f}%")
    print("=" * 60)

    if wrong > 0:
        print()
        print("  FALLOS:")
        for real_id, pred_id, score, status in results:
            if status == "FALLO":
                rn = employees.get(real_id, {}).get("nombre", "?")
                pn = employees.get(pred_id, {}).get("nombre", "?")
                print(f"    ID {real_id} ({rn}) -> confundido con ID {pred_id} ({pn}) score={score:.4f}")


if __name__ == "__main__":
    main()
