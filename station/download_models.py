"""
Descarga los modelos DNN de OpenCV Zoo necesarios para el reconocimiento facial.
Ejecutar una sola vez por máquina:

    python download_models.py

Modelos:
  - YuNet  : detección de rostros (face_detection_yunet_2023mar.onnx)
  - SFace  : embeddings faciales 128d (face_recognition_sface_2021dec.onnx)
"""

import urllib.request
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODELS = [
    (
        "face_detection_yunet_2023mar.onnx",
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    ),
    (
        "face_recognition_sface_2021dec.onnx",
        "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    ),
]


def _progress(filename: str):
    def _hook(count, block_size, total_size):
        if total_size <= 0:
            return
        pct = min(count * block_size * 100 // total_size, 100)
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"\r  [{bar}] {pct:3d}%  {filename}", end="", flush=True)
    return _hook


def main():
    print("=" * 55)
    print("Safe Link — Descarga de modelos DNN")
    print("=" * 55)

    all_ok = True
    for filename, url in MODELS:
        dest = MODELS_DIR / filename
        if dest.exists():
            print(f"  [OK] {filename} ya existe ({dest.stat().st_size // 1024} KB)")
            continue
        print(f"\n  Descargando {filename}...")
        try:
            urllib.request.urlretrieve(url, dest, reporthook=_progress(filename))
            print(f"\n  [OK] Guardado en {dest}")
        except Exception as e:
            print(f"\n  [ERROR] {e}")
            all_ok = False

    print("\n" + "=" * 55)
    if all_ok:
        print("Modelos listos. Ahora puedes correr la estacion.")
        print("   python run_station.py")
    else:
        print("Algunos modelos fallaron. Verifica tu conexion a internet.")
    print("=" * 55)


if __name__ == "__main__":
    main()
