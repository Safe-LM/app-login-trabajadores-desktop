"""
Utilidades para procesar fotos WMF y convertirlas a JPG.
"""

from pathlib import Path
from PIL import Image
import os
import shutil


def convert_wmf_to_jpg(wmf_path: Path, output_path: Path):
    """Convertir archivo WMF a JPG."""
    try:
        # Abrir imagen WMF
        img = Image.open(wmf_path)

        # Convertir a RGB si es necesario
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Guardar como JPG
        img.save(output_path, "JPEG", quality=95)
        return True
    except Exception as e:
        print(f"Error convirtiendo {wmf_path}: {e}")
        # Intentar con OpenCV como fallback
        try:
            import cv2
            import numpy as np

            # Algunos WMF pueden leerse directamente
            img_array = cv2.imread(str(wmf_path))
            if img_array is not None:
                cv2.imwrite(str(output_path), img_array, [cv2.IMWRITE_JPEG_QUALITY, 95])
                return True
        except Exception:
            pass
        return False


def process_photos_folder(source_folder: Path, dest_folder: Path):
    """Procesar todas las fotos WMF de una carpeta."""
    dest_folder.mkdir(parents=True, exist_ok=True)

    processed = 0
    for wmf_file in source_folder.glob("*.wmf"):
        # Crear nombre de salida
        jpg_name = wmf_file.stem + ".jpg"
        jpg_path = dest_folder / jpg_name

        if convert_wmf_to_jpg(wmf_file, jpg_path):
            processed += 1
            print(f"[OK] Convertido: {wmf_file.name} -> {jpg_name}")

    # También copiar JPG/PNG si existen
    for img_file in source_folder.glob("*.jpg"):
        dest_path = dest_folder / img_file.name
        shutil.copy2(img_file, dest_path)
        processed += 1
        print(f"[OK] Copiado: {img_file.name}")

    for img_file in source_folder.glob("*.png"):
        dest_path = dest_folder / img_file.name
        shutil.copy2(img_file, dest_path)
        processed += 1
        print(f"[OK] Copiado: {img_file.name}")

    return processed
