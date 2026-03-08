"""
Sistema mejorado de reconocimiento facial.
Usa técnicas avanzadas para mejorar la precisión del reconocimiento.
"""

import cv2
import numpy as np
from pathlib import Path
import sys

# Agregar paths necesarios
root_path = Path(__file__).parent.parent.parent
deteccion_path = root_path / "deteccion_vision_demo1"

if str(deteccion_path) not in sys.path:
    sys.path.insert(0, str(deteccion_path))

try:
    import deteccion_vision_demo1.demo_seguridad as ds
except ImportError:
    print("⚠️ No se pudo importar demo_seguridad")
    ds = None


def mejorar_imagen_para_reconocimiento(img):
    """
    Mejora la imagen para mejor reconocimiento facial.
    Aplica normalización, mejora de contraste y reducción de ruido.
    """
    if img is None or img.size == 0:
        return None

    # Convertir a escala de grises si es necesario (para algunas operaciones)
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # Aplicar CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Si la imagen original era a color, convertir de vuelta
    if len(img.shape) == 3:
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    # Reducción de ruido
    denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)

    return denoised


def extraer_embedding_mejorado(img, bbox):
    """
    Extrae embedding mejorado usando múltiples técnicas.
    """
    if ds is None:
        return None

    x1, y1, x2, y2 = [int(v) for v in bbox]

    # Recortar la persona
    persona_img = img[max(0, y1) : y2, max(0, x1) : x2]

    if persona_img.size == 0:
        return None

    # Mejorar imagen
    persona_img = mejorar_imagen_para_reconocimiento(persona_img)

    if persona_img is None:
        return None

    # Intentar usar OSNet primero (más preciso)
    if ds.modelo_osnet is not None:
        try:
            if callable(ds.modelo_osnet):
                # FeatureExtractor de torchreid
                embedding = ds.modelo_osnet(persona_img)
                if isinstance(embedding, list):
                    embedding = embedding[0]
                return embedding
            else:
                # Modelo PyTorch directo
                import torch
                from torchvision import transforms

                # Transformar imagen para el modelo
                transform = transforms.Compose(
                    [
                        transforms.ToPILImage(),
                        transforms.Resize((256, 128)),
                        transforms.ToTensor(),
                        transforms.Normalize(
                            mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
                        ),
                    ]
                )

                img_rgb = cv2.cvtColor(persona_img, cv2.COLOR_BGR2RGB)
                img_tensor = transform(img_rgb).unsqueeze(0)

                with torch.no_grad():
                    embedding = ds.modelo_osnet(img_tensor)

                return embedding.numpy().flatten()
        except Exception as e:
            print(f"⚠️ Error usando OSNet: {e}, usando fallback")

    # Fallback: Usar características faciales mejoradas (LBP + Histogramas)
    return extraer_embedding_facial_mejorado(persona_img)


def extraer_embedding_facial_mejorado(img):
    """
    Extrae embedding usando características faciales mejoradas.
    Combina LBP (Local Binary Patterns) con histogramas de color.
    """
    # Convertir a RGB si es necesario
    if len(img.shape) == 3:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    else:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)

    # 1. LBP (Local Binary Patterns) - características de textura facial
    try:
        from skimage import feature

        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        lbp = feature.local_binary_pattern(gray, 24, 3, method="uniform")
        hist_lbp, _ = np.histogram(lbp.ravel(), bins=26, range=(0, 26))
        hist_lbp = hist_lbp.astype(np.float32)
        cv2.normalize(hist_lbp, hist_lbp)
    except ImportError:
        # Si no está scikit-image, usar histograma simple
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        hist_lbp = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        cv2.normalize(hist_lbp, hist_lbp)

    # 2. Histogramas de color HSV (mejorados)
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [50], [0, 180])
    hist_s = cv2.calcHist([hsv], [1], None, [60], [0, 256])
    hist_v = cv2.calcHist([hsv], [2], None, [60], [0, 256])

    cv2.normalize(hist_h, hist_h)
    cv2.normalize(hist_s, hist_s)
    cv2.normalize(hist_v, hist_v)

    # 3. Características de forma (momentos de imagen)
    moments = cv2.moments(gray)
    hu_moments = cv2.HuMoments(moments).flatten()
    # Normalizar momentos (log scale para mejor comparación)
    hu_moments = -np.sign(hu_moments) * np.log10(np.abs(hu_moments) + 1e-10)

    # Combinar todas las características
    embedding = np.concatenate(
        [
            hist_lbp.flatten(),
            hist_h.flatten(),
            hist_s.flatten(),
            hist_v.flatten(),
            hu_moments.flatten(),
        ]
    )

    return embedding.astype(np.float32)


def comparar_embeddings_mejorado(emb1, emb2):
    """
    Compara embeddings usando múltiples métricas y combina los resultados.
    """
    if emb1 is None or emb2 is None:
        return 0.0

    try:
        emb1 = np.array(emb1).flatten().astype(np.float32)
        emb2 = np.array(emb2).flatten().astype(np.float32)

        if len(emb1) != len(emb2):
            # Si tienen diferente tamaño, usar solo las primeras características comunes
            min_len = min(len(emb1), len(emb2))
            emb1 = emb1[:min_len]
            emb2 = emb2[:min_len]

        # 1. Similitud coseno (mejor para embeddings normalizados)
        dot = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)

        if norm1 == 0 or norm2 == 0:
            cosine_sim = 0.0
        else:
            cosine_sim = dot / (norm1 * norm2)
            # Normalizar a 0-1 (coseno da -1 a 1)
            cosine_sim = (cosine_sim + 1) / 2

        # 2. Correlación de Pearson
        if len(emb1) > 1:
            correlation = np.corrcoef(emb1, emb2)[0, 1]
            if np.isnan(correlation):
                correlation = 0.0
            # Normalizar a 0-1
            correlation = (correlation + 1) / 2
        else:
            correlation = cosine_sim

        # 3. Distancia euclidiana normalizada (invertida)
        euclidean_dist = np.linalg.norm(emb1 - emb2)
        max_dist = np.linalg.norm(emb1) + np.linalg.norm(emb2)
        if max_dist > 0:
            euclidean_sim = 1 - (euclidean_dist / max_dist)
        else:
            euclidean_sim = 0.0

        # Combinar métricas (promedio ponderado)
        # Dar más peso a similitud coseno
        similitud_final = 0.5 * cosine_sim + 0.3 * correlation + 0.2 * euclidean_sim

        return float(np.clip(similitud_final, 0.0, 1.0))

    except Exception as e:
        print(f"⚠️ Error comparando embeddings: {e}")
        return 0.0
