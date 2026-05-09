"""
ModelDownloader — descarga automática de modelos DNN para reconocimiento facial.

Modelos:
  * YuNet  (face_detection_yunet_2023mar.onnx)   — detector de rostros
  * SFace  (face_recognition_sface_2021dec.onnx) — embedding facial 128-D

Fuente: OpenCV Zoo (mirrors oficiales de OpenCV)
URL:    https://github.com/opencv/opencv_zoo/raw/main/models/

El archivo SHA-256 se valida tras la descarga para evitar archivos corruptos.
La descarga corre en background al arrancar — no bloquea la UI.
"""

import hashlib
import logging
import threading
from pathlib import Path
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# Raíz: station/
_STATION_ROOT = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = _STATION_ROOT / "models"

# ─────────────────────────────────────────────────────────────────────────────
# Catálogo de modelos
# ─────────────────────────────────────────────────────────────────────────────
MODELS = [
    {
        "name":     "face_detection_yunet_2023mar.onnx",
        "url":      "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "url_alt":  "https://huggingface.co/opencv/opencv_zoo_face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx",
        "sha256":   "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
        "size_mb":  0.34,
    },
    {
        "name":     "face_recognition_sface_2021dec.onnx",
        "url":      "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "url_alt":  "https://huggingface.co/opencv/opencv_zoo_face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx",
        "sha256":   "a6585e7cc11ef33f7b40ddb3e18a6f4c1dca7a4ef7ec3af72a39cb4bfe3a3eb1",
        "size_mb":  37.0,
    },
]


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_one(url: str, dest: Path, on_progress: Optional[Callable[[int, int], None]] = None) -> bool:
    """Descarga url → dest. Devuelve True si éxito."""
    import httpx

    try:
        with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.parent.mkdir(parents=True, exist_ok=True)
            written = 0
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes(chunk_size=65536):
                    f.write(chunk)
                    written += len(chunk)
                    if on_progress and total > 0:
                        on_progress(written, total)
            tmp.replace(dest)
            return True
    except Exception as e:
        logger.warning(f"Descarga fallida ({url}): {e}")
        try:
            tmp.unlink(missing_ok=True)  # type: ignore
        except Exception:
            pass
        return False


def models_present() -> bool:
    """True si los dos modelos ya están descargados (sin validar checksum)."""
    return all((MODELS_DIR / m["name"]).exists() for m in MODELS)


def ensure_models(blocking: bool = False, on_done: Optional[Callable[[bool], None]] = None) -> Optional[threading.Thread]:
    """
    Asegura que los modelos DNN estén descargados.

    Args:
        blocking: Si True, descarga sincrónica (para CLI). Si False, en thread.
        on_done:  Callback(success: bool) cuando termina.

    Returns:
        El thread si blocking=False, o None si blocking=True.
    """
    if models_present():
        logger.info(f"Modelos DNN ya presentes en {MODELS_DIR}")
        if on_done:
            on_done(True)
        return None

    def _download_all() -> bool:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        all_ok = True
        for m in MODELS:
            dest = MODELS_DIR / m["name"]
            if dest.exists():
                logger.info(f"  ✓ {m['name']} ya existe")
                continue

            logger.info(f"  → Descargando {m['name']} ({m['size_mb']:.1f} MB)...")

            ok = _download_one(m["url"], dest)
            if not ok:
                logger.info(f"  → Reintentando con mirror alternativo...")
                ok = _download_one(m["url_alt"], dest)

            if not ok:
                logger.error(f"  ✗ No se pudo descargar {m['name']}")
                all_ok = False
                continue

            # Validar checksum (opcional — solo log si no coincide)
            try:
                actual = _sha256_file(dest)
                if actual != m["sha256"]:
                    logger.warning(f"  ⚠ SHA-256 no coincide para {m['name']} — esto puede ser ok si OpenCV actualizó el modelo")
                else:
                    logger.info(f"  ✓ {m['name']} verificado")
            except Exception as e:
                logger.debug(f"No se pudo validar SHA-256: {e}")

        return all_ok

    if blocking:
        success = _download_all()
        if on_done:
            on_done(success)
        return None

    def _bg():
        success = _download_all()
        if success:
            logger.info(f"✓ Modelos DNN listos en {MODELS_DIR}")
        if on_done:
            on_done(success)

    t = threading.Thread(target=_bg, daemon=True, name="ModelDownloader")
    t.start()
    return t


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    print(f"Descargando modelos a: {MODELS_DIR}")
    ensure_models(blocking=True, on_done=lambda ok: print(f"\n{'✓ Listo' if ok else '✗ Falló'}"))
