"""
SyncManager — sincronización de empleados desde Supabase.

Descarga empleados de la empresa de esta estación usando su api_key,
guarda fotos y JSON en data/cache/<empresa_id>/ para uso offline.
Corre al arrancar y cada 4 horas en background (QThread).
"""

import json
import logging
import pickle
import time
from pathlib import Path
from typing import Optional

import httpx
from PyQt5.QtCore import QObject, QThread, QTimer, pyqtSignal

from utils.supabase_client import get_supabase_client
from utils.station_manager import StationInfo, get_station_api_key
from utils.paths import cache_root, models_root, bundled_models_root

logger = logging.getLogger(__name__)

# CACHE_DIR ahora se resuelve a una ruta escribible (APPDATA en builds
# instalados, station/data/cache en dev local). Ver utils/paths.py.
CACHE_DIR = cache_root()
SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000  # 4 horas


def _get_cache_dir(empresa_id: str) -> Path:
    d = CACHE_DIR / empresa_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "photos").mkdir(exist_ok=True)
    (d / "json").mkdir(exist_ok=True)
    return d


def _log_to_supabase(tipo: str, detalle: dict):
    """Envía un log a Supabase de forma silenciosa (no bloquea)."""
    api_key = get_station_api_key()
    if not api_key:
        return
    try:
        sb = get_supabase_client()
        sb.rpc("insertar_log_estacion", {
            "p_api_key": api_key,
            "p_tipo": tipo,
            "p_detalle": detalle,
        }).execute()
    except Exception:
        pass


def _notify_panel(
    tipo: str,
    severidad: str,
    titulo: str,
    mensaje: Optional[str] = None,
    metadata: Optional[dict] = None,
    dedupe_key: Optional[str] = None,
):
    """Crea una notificación visible en el panel web vía RPC.

    severidad: 'info' | 'warn' | 'error' | 'critical'
    dedupe_key: si se provee, no se duplica dentro de los últimos 30 min.
    """
    api_key = get_station_api_key()
    if not api_key:
        return
    try:
        sb = get_supabase_client()
        sb.rpc("crear_notif_estacion", {
            "p_api_key":   api_key,
            "p_tipo":      tipo,
            "p_severidad": severidad,
            "p_titulo":    titulo,
            "p_mensaje":   mensaje,
            "p_metadata":  metadata or {},
            "p_dedupe_key": dedupe_key,
        }).execute()
    except Exception:
        pass


class SyncWorker(QThread):
    """Worker que corre en background y descarga empleados de Supabase."""

    sync_done    = pyqtSignal(int)   # nº de empleados sincronizados
    sync_error   = pyqtSignal(str)   # mensaje de error
    sync_started = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._force = False

    def force_sync(self):
        self._force = True
        if not self.isRunning():
            self.start()

    def run(self):
        self.sync_started.emit()
        last_err = None
        for attempt in range(3):
            try:
                count = _do_sync()
                self.sync_done.emit(count)
                return
            except Exception as e:
                last_err = e
                logger.warning(f"SyncWorker intento {attempt+1}/3 falló: {e}")
                self.msleep(3000 * (attempt + 1))  # 3s, 6s, 9s
        logger.error(f"SyncWorker error tras 3 intentos: {last_err}")
        self.sync_error.emit(str(last_err))
        self._force = False


def _do_sync() -> int:
    """
    Lógica real de sincronización:
    1. Llama get_empleados_empresa(api_key) → lista de empleados
    2. Compara con caché local por updated_at (sync delta)
    3. Descarga solo las fotos nuevas o modificadas
    4. Descarga embeddings desde Supabase (pgvector)
    5. Genera encodings locales como fallback si no hay en Supabase
    """
    api_key = get_station_api_key()
    if not api_key:
        raise RuntimeError("No hay STATION_API_KEY configurada")

    sb = get_supabase_client()

    # 1. Obtener empleados desde Supabase
    result = sb.rpc("get_empleados_empresa", {"p_api_key": api_key}).execute()
    if not result.data or not result.data.get("ok"):
        error = result.data.get("error", "respuesta inválida") if result.data else "sin respuesta"
        raise RuntimeError(f"get_empleados_empresa falló: {error}")

    empresa_id: str = result.data["empresa_id"]
    empleados: list = result.data["empleados"]

    # Propagar empresa_id a StationInfo si la station arranco en modo
    # legacy (con solo STATION_API_KEY en .env, sin station_config.json).
    # Sin esto, get_opencv_recognizer() no resuelve cache_root() / empresa_id
    # y cae al fallback legacy 'database_fotos/' que no existe — entonces
    # los modelos no se cargan y el reconocimiento queda sin embeddings.
    try:
        from utils.station_manager import StationInfo
        if not StationInfo.empresa_id:
            StationInfo.empresa_id = empresa_id
            logger.info(f"StationInfo.empresa_id auto-poblado desde sync: {empresa_id}")
    except Exception:
        pass

    cache_dir = _get_cache_dir(empresa_id)
    json_path = cache_dir / "json" / "employees_db.json"
    photos_dir = cache_dir / "photos"
    encodings_file = cache_dir / "face_encodings_opencv.pkl"

    # 2. Cargar caché local para sync delta
    local_map: dict = {}
    if json_path.exists():
        try:
            for e in json.loads(json_path.read_text("utf-8")):
                local_map[e["id"]] = e.get("updated_at", "")
        except Exception:
            pass

    # 3. Descargar fotos nuevas o modificadas
    new_photos = 0
    for emp in empleados:
        emp_id = emp["id"]
        foto_url = emp.get("foto_url", "")
        if not foto_url:
            emp["foto_local"] = ""
            continue

        foto_ext = Path(foto_url.split("?")[0]).suffix or ".jpg"
        foto_path = photos_dir / f"{emp_id}{foto_ext}"
        emp["foto_local"] = str(foto_path)

        local_updated = local_map.get(emp_id, "")
        remote_updated = emp.get("updated_at", "")
        needs_download = not foto_path.exists() or (remote_updated and remote_updated != local_updated)

        if needs_download and foto_url.startswith("http"):
            try:
                r = httpx.get(foto_url, timeout=15, follow_redirects=True)
                if r.status_code == 200:
                    foto_path.write_bytes(r.content)
                    new_photos += 1
                    _log_to_supabase("foto_descargada", {
                        "empleado_id": emp_id,
                        "bytes": len(r.content),
                    })
                else:
                    _log_to_supabase("foto_error_descarga", {
                        "empleado_id": emp_id,
                        "http_status": r.status_code,
                    })
            except Exception as ex:
                logger.warning(f"No se pudo descargar foto de {emp_id}: {ex}")
                emp["foto_local"] = ""
                _log_to_supabase("foto_error_descarga", {
                    "empleado_id": emp_id,
                    "error": str(ex)[:200],
                })

    # 4. Guardar employees.json actualizado
    json_path.write_text(json.dumps(empleados, ensure_ascii=False, indent=2), "utf-8")

    # 5. Intentar descargar embeddings desde Supabase (pgvector)
    embeddings_updated = _download_embeddings_from_supabase(sb, empresa_id, cache_dir, empleados)

    # 6. AUTO-HEALING: decidir si regenerar embeddings localmente.
    #
    # Triggers (cualquiera dispara la regeneracion):
    #  a. Hay fotos nuevas que no se han procesado.
    #  b. Hay empleados sin enrollar (enrollado=false) con foto.
    #  c. NUEVO: la station no tiene el .pkl local y hay fotos.
    #
    # El caso (c) cubre el bug: en BD el empleado tenia enrollado=true
    # y embeddings en pgvector, pero el pkl local no existe (la station
    # nunca pudo bajarlo o el download fallo silenciosamente). Sin este
    # trigger la station se quedaria zombie con cero capacidad de
    # reconocer indefinidamente.
    new_encodings = 0
    no_enrollados = [e for e in empleados if not e.get("enrollado", False) and e.get("foto_local")]
    fotos_disponibles = [e for e in empleados if e.get("foto_local")]
    pkl_missing = not encodings_file.exists()

    should_regenerate = (
        not embeddings_updated and
        (new_photos > 0 or no_enrollados or (pkl_missing and fotos_disponibles))
    )

    if should_regenerate:
        if pkl_missing and not no_enrollados and new_photos == 0:
            # Caso (c): auto-healing porque el pkl no existe.
            logger.info(
                f"Auto-healing: pkl local ausente, regenerando embeddings "
                f"desde {len(fotos_disponibles)} foto(s) disponible(s)"
            )
            _log_to_supabase("embeddings_fallback_local", {
                "razon": "pkl_local_ausente",
                "fotos_disponibles": len(fotos_disponibles),
                "supabase_download": "fallido_o_vacio",
            })
        elif no_enrollados and new_photos == 0:
            logger.info(f"Generando embeddings para {len(no_enrollados)} empleado(s) no enrollado(s)")

        encodings, employee_ids = _regenerate_encodings(cache_dir, empleados)
        if encodings and employee_ids:
            new_encodings = len(encodings)
            # Subir embeddings a Supabase para que otras estaciones los usen
            _upload_embeddings_to_supabase(sb, empresa_id, cache_dir, employee_ids, encodings)
            # Marcar empleados como enrollados
            _mark_employees_enrolled(sb, employee_ids)

    total = len(empleados)
    source = "Supabase" if embeddings_updated else f"local ({new_encodings} nuevos)"
    logger.info(f"Sync OK — {total} empleados, {new_photos} fotos descargadas, embeddings: {source}")
    _log_to_supabase("sync_ok", {
        "empleados": total,
        "fotos_descargadas": new_photos,
        "embeddings_nuevos": new_encodings,
        "empresa_id": empresa_id,
    })

    # Actualizar rutas en los matchers en memoria
    _reload_matchers(cache_dir)

    # Reportar métricas de salud al heartbeat
    try:
        encodings_file = cache_dir / "face_encodings_opencv.pkl"
        enc_ver = int(encodings_file.stat().st_mtime) if encodings_file.exists() else 0
        from utils.station_manager import report_health
        report_health(empleados_count=total, encodings_ver=enc_ver)
    except Exception:
        pass

    return total


def _download_embeddings_from_supabase(sb, empresa_id: str, cache_dir: Path, empleados: list) -> bool:
    """
    Descarga embeddings desde Supabase (tabla embeddings_faciales).

    Cada paso emite log estructurado a logs_estacion para que el admin
    pueda diagnosticar fallos desde /actividad. Antes este flujo fallaba
    silenciosamente con warning local y nadie se enteraba.

    Returns:
        True si se descargaron embeddings y se persistieron en disco,
        False si no hay embeddings o si fallo cualquier paso.
    """
    encodings_file = cache_dir / "face_encodings_opencv.pkl"

    # Log 1: inicio
    _log_to_supabase("embeddings_download_started", {
        "empresa_id": empresa_id,
        "empleados_esperados": len(empleados),
    })

    # Paso 1: query a Supabase via RPC (SECURITY DEFINER, autenticado
    # por api_key del dispositivo). Antes usabamos sb.table().select()
    # directo, pero la RLS de embeddings_faciales exige JWT con
    # empresa_id en metadata — la station no tiene JWT, solo api_key,
    # asi que RLS devolvia 0 filas silenciosamente.
    try:
        api_key = get_station_api_key()
        if not api_key:
            _log_to_supabase("embeddings_download_failed", {
                "etapa": "auth",
                "error": "sin api_key",
            })
            return False
        result = sb.rpc("get_embeddings_empresa", {"p_api_key": api_key}).execute()
    except Exception as e:
        msg = str(e)[:300]
        logger.warning(f"Embeddings: RPC fallo: {msg}")
        _log_to_supabase("embeddings_download_failed", {
            "etapa": "query",
            "error": msg,
        })
        return False

    payload = result.data or {}
    if not payload.get("ok"):
        err = payload.get("error", "respuesta invalida")
        logger.warning(f"Embeddings RPC: {err}")
        _log_to_supabase("embeddings_download_failed", {
            "etapa": "query",
            "razon": err,
        })
        return False

    rows = payload.get("embeddings") or []
    if not rows:
        logger.info("No hay embeddings en Supabase para esta empresa")
        _log_to_supabase("embeddings_download_failed", {
            "etapa": "query",
            "razon": "supabase_sin_embeddings",
            "empleados": len(empleados),
        })
        return False

    # Paso 2: parsear embeddings.
    # El RPC devuelve embedding como texto JSON con shape "[v0, v1, ...]"
    # (pgvector::text). Tambien soportamos formatos legacy (list, str
    # con prefijo bracket) por compatibilidad.
    encodings: list = []
    employee_ids: list = []
    parse_errors = 0

    import numpy as np

    for row in rows:
        emp_id = str(row.get("empleado_id", ""))
        emb = row.get("embedding")
        try:
            if isinstance(emb, str):
                # pgvector::text formato: "[0.1,0.2,...]" — json.loads lo parsea bien
                emb = np.array(json.loads(emb), dtype=np.float32)
            elif isinstance(emb, list):
                emb = np.array(emb, dtype=np.float32)
            elif emb is None:
                parse_errors += 1
                continue
            else:
                parse_errors += 1
                continue
            encodings.append(emb)
            employee_ids.append(emp_id)
        except Exception as e:
            parse_errors += 1
            logger.debug(f"Embeddings: parse error emp={emp_id[:8]}: {e}")

    if not encodings:
        logger.warning(f"Embeddings: 0 validos despues de parsear ({parse_errors} errores)")
        _log_to_supabase("embeddings_download_failed", {
            "etapa": "parse",
            "filas_recibidas": len(rows),
            "parse_errors": parse_errors,
        })
        return False

    # Paso 3: persistir a disco
    unique_emps = len(set(employee_ids))
    is_augmented = len(encodings) > unique_emps

    data = {
        "encodings": encodings,
        "employee_ids": employee_ids,
        "augmented": is_augmented,
        "version": 3,
        "source": "supabase",
    }

    try:
        with open(encodings_file, "wb") as f:
            pickle.dump(data, f)
    except Exception as e:
        msg = str(e)[:300]
        logger.warning(f"Embeddings: no se pudo escribir pkl: {msg}")
        _log_to_supabase("embeddings_download_failed", {
            "etapa": "write_pkl",
            "path": str(encodings_file),
            "error": msg,
        })
        return False

    logger.info(
        f"Embeddings descargados de Supabase: {unique_emps} empleados, "
        f"{len(encodings)} embeddings"
        f"{' (augmented)' if is_augmented else ''}"
    )
    _log_to_supabase("embeddings_download_ok", {
        "empleados": unique_emps,
        "embeddings": len(encodings),
        "augmented": is_augmented,
        "parse_errors": parse_errors,
    })
    return True


def _crop_face_bbox(frame, detector, padding_ratio: float = 0.4):
    """
    Detecta el rostro mas grande de la imagen y devuelve un crop centrado
    con padding alrededor para preservar contexto facial (frente, menton,
    orejas). Si no hay deteccion devuelve None.

    El crop centrado en la cara es CRITICO para enrollment robusto:
      - El embedding deja de mezclar fondo/ropa que cambian de dia a dia.
      - Las rotaciones leves NO sacan la cara del frame.
      - Las variaciones de brillo no se ven dominadas por background.

    padding_ratio=0.4 es el sweet spot empirico: incluye contexto facial
    suficiente para alignment landmarks pero excluye torso/fondo.
    """
    import cv2
    import numpy as np

    h, w = frame.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(frame)
    if faces is None or len(faces) == 0:
        return None

    # Tomar la cara mas grande (no la de mayor score — mas robusto en
    # fotos donde puede haber otras personas en background lejano)
    areas = (faces[:, 2] * faces[:, 3]) * faces[:, -1]  # area * score
    face_info = faces[np.argmax(areas)]
    x, y, fw, fh = int(face_info[0]), int(face_info[1]), int(face_info[2]), int(face_info[3])

    # Padding proporcional al tamaño detectado, clamp a bordes
    pad_x = int(fw * padding_ratio)
    pad_y = int(fh * padding_ratio)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(w, x + fw + pad_x)
    y2 = min(h, y + fh + pad_y)

    crop = frame[y1:y2, x1:x2]
    if crop.size == 0 or crop.shape[0] < 64 or crop.shape[1] < 64:
        return None
    return crop


def _augment_image(frame):
    """
    Genera 10 variaciones por foto siguiendo el approach del v3 SFace original.
    Esto pasa la precisión de ~85% con 1 embedding a ~99% con 10.
    Variaciones: original, flip H, 4 brillo/contraste, 2 rotaciones, ruido, blur.

    IMPORTANTE: idealmente `frame` ya viene cropeado a la cara (via
    _crop_face_bbox) — el augmentation sobre la foto completa puede
    mover la cara fuera del frame en las rotaciones.
    """
    import cv2
    import numpy as np

    variants = []
    h, w = frame.shape[:2]

    # 1. Original
    variants.append(frame)

    # 2. Flip horizontal (espejo)
    variants.append(cv2.flip(frame, 1))

    # 3-6. Variaciones de brillo y contraste (4)
    for alpha, beta in [(0.85, -10), (1.15, 10), (0.85, -25), (1.15, 30)]:
        variants.append(cv2.convertScaleAbs(frame, alpha=alpha, beta=beta))

    # 7-8. Rotaciones leves (±8°)
    for angle in [-8, 8]:
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        variants.append(cv2.warpAffine(frame, M, (w, h), borderMode=cv2.BORDER_REFLECT))

    # 9. Ruido gaussiano leve (σ=5)
    noise = np.random.normal(0, 5, frame.shape).astype(np.int16)
    noisy = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    variants.append(noisy)

    # 10. Desenfoque gaussiano leve (3x3)
    variants.append(cv2.GaussianBlur(frame, (3, 3), 0))

    return variants


def _regenerate_encodings(cache_dir: Path, _empleados: list) -> tuple:
    """
    Genera face_encodings_opencv.pkl desde las fotos descargadas en cache.
    Aplica data augmentation (10 variantes por foto) para alcanzar ~99% precisión.

    Returns:
        (encodings, employee_ids) — listas paralelas, con 10 entradas por empleado
    """
    try:
        import pickle
        import cv2
        import numpy as np

        photos_dir = cache_dir / "photos"
        encodings_file = cache_dir / "face_encodings_opencv.pkl"

        if not photos_dir.exists():
            logger.warning(f"Directorio de fotos no existe: {photos_dir}")
            return [], []

        # Obtener modelos DNN: primero buscar en la ruta de descarga
        # (writable, APPDATA en build instalado), luego en la ruta del
        # bundle (read-only, solo si vinieron pre-empaquetados).
        for models_dir in (models_root(), bundled_models_root()):
            yunet_path = models_dir / "face_detection_yunet_2023mar.onnx"
            sface_path = models_dir / "face_recognition_sface_2021dec.onnx"
            if yunet_path.exists() and sface_path.exists():
                break

        if not yunet_path.exists() or not sface_path.exists():
            logger.warning(f"Modelos DNN no encontrados en {models_dir}")
            return [], []

        detector = cv2.FaceDetectorYN.create(str(yunet_path), "", (320, 320))
        detector.setScoreThreshold(0.6)
        recognizer = cv2.FaceRecognizerSF.create(str(sface_path), "")

        extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        encodings = []
        employee_ids = []
        empleados_procesados = 0
        empleados_fallidos = 0
        fallidos_detalle = []  # para el log final

        fotos_a_procesar = [f for f in photos_dir.iterdir() if f.suffix.lower() in extensions]
        _log_to_supabase("training_started", {
            "fotos_encontradas": len(fotos_a_procesar),
            "modelo": "sface_v3",
        })

        for foto_path in fotos_a_procesar:
            emp_id = foto_path.stem

            try:
                frame = cv2.imread(str(foto_path))
                if frame is None:
                    empleados_fallidos += 1
                    fallidos_detalle.append({"empleado_id": emp_id, "razon": "imagen_no_decodificable"})
                    _log_to_supabase("embedding_failed", {
                        "empleado_id": emp_id, "razon": "imagen_no_decodificable",
                    })
                    continue

                # PASO 1: detectar bbox del rostro PRIMERO y crop centrado.
                # Esto elimina fondo/ropa del embedding y garantiza que
                # las rotaciones del augmentation no muevan la cara fuera
                # del frame. Si no hay deteccion en la foto original,
                # fallback a la foto completa (mejor algo que nada).
                face_crop = _crop_face_bbox(frame, detector, padding_ratio=0.4)
                if face_crop is None:
                    logger.warning(f"  [{emp_id[:8]}] no se detecto rostro en foto original, usando foto completa")
                    _log_to_supabase("enrollment_no_bbox", {
                        "empleado_id": emp_id, "fallback": "foto_completa",
                    })
                    face_crop = frame

                # PASO 2: generar 10 variaciones SOBRE EL CROP centrado.
                variants = _augment_image(face_crop)
                emb_count = 0

                for variant in variants:
                    h, w = variant.shape[:2]
                    detector.setInputSize((w, h))
                    _, faces = detector.detect(variant)

                    if faces is None or len(faces) == 0:
                        continue

                    # Tomar la cara mas grande (no solo mayor score) —
                    # robusto contra detecciones espureas en el crop.
                    areas = (faces[:, 2] * faces[:, 3]) * faces[:, -1]
                    face_info = faces[np.argmax(areas)]
                    aligned = recognizer.alignCrop(variant, face_info)
                    embedding = recognizer.feature(aligned).flatten()

                    encodings.append(embedding)
                    employee_ids.append(emp_id)
                    emb_count += 1

                if emb_count > 0:
                    empleados_procesados += 1
                    logger.debug(f"  [{emp_id[:8]}] {emb_count}/10 embeddings (augmented)")
                    _log_to_supabase("embedding_generated", {
                        "empleado_id": emp_id,
                        "variantes_ok": emb_count,
                        "variantes_total": len(variants),
                    })
                else:
                    empleados_fallidos += 1
                    fallidos_detalle.append({"empleado_id": emp_id, "razon": "sin_rostro_detectado"})
                    logger.debug(f"Sin rostro detectado en ninguna variante: {foto_path.name}")
                    _log_to_supabase("embedding_failed", {
                        "empleado_id": emp_id,
                        "razon": "sin_rostro_detectado",
                        "variantes_intentadas": len(variants),
                    })

            except Exception as e:
                empleados_fallidos += 1
                fallidos_detalle.append({"empleado_id": emp_id, "razon": str(e)[:100]})
                logger.debug(f"Error con {foto_path.name}: {e}")
                _log_to_supabase("embedding_failed", {
                    "empleado_id": emp_id, "razon": str(e)[:200],
                })
                continue

        if not encodings:
            logger.warning("No se generaron encodings desde las fotos")
            return [], []

        data = {
            "encodings": encodings,
            "employee_ids": employee_ids,
            "augmented": True,        # ahora SÍ
            "version": 3,
        }

        with open(encodings_file, "wb") as f:
            pickle.dump(data, f)

        avg = len(encodings) / max(empleados_procesados, 1)
        logger.info(
            f"Entrenamiento facial: {empleados_procesados} empleados OK, {empleados_fallidos} fallidos · "
            f"{len(encodings)} embeddings totales (~{avg:.1f}/persona)"
        )
        _log_to_supabase("training_completed", {
            "empleados_procesados": empleados_procesados,
            "empleados_fallidos": empleados_fallidos,
            "embeddings_totales": len(encodings),
            "embeddings_por_persona": round(avg, 1),
            "fallidos_detalle": fallidos_detalle[:20],  # limitar para no saturar el JSON
        })
        return encodings, employee_ids

    except Exception as e:
        logger.warning(f"No se pudieron regenerar encodings: {e}")
        _log_to_supabase("training_completed", {
            "error": str(e)[:300],
            "empleados_procesados": 0,
            "empleados_fallidos": -1,
        })
        return [], []


def _upload_embeddings_to_supabase(sb, empresa_id: str, cache_dir: Path, employee_ids: list, encodings: list) -> bool:
    """
    Sube embeddings (con augmentation: ~10 por empleado) usando RPC batch.
    Agrupa por empleado y los sube en una sola transacción que reemplaza los viejos.
    """
    api_key = get_station_api_key()
    if not api_key:
        logger.warning("Sin api_key — no se pueden subir embeddings")
        return False

    # Agrupar embeddings por empleado_id
    grouped: dict = {}
    for emp_id, emb in zip(employee_ids, encodings):
        emb_list = emb.tolist() if hasattr(emb, "tolist") else list(emb)
        emb_str = "[" + ",".join(map(str, emb_list)) + "]"
        grouped.setdefault(str(emp_id), []).append(emb_str)

    success = 0
    for emp_id, emb_array in grouped.items():
        try:
            result = sb.rpc("subir_embeddings_estacion_batch", {
                "p_api_key":        api_key,
                "p_empleado_id":    emp_id,
                "p_embeddings":     emb_array,
                "p_modelo_version": "sface_v3",
            }).execute()

            data = result.data or {}
            if data.get("ok"):
                success += 1
                logger.debug(f"  {emp_id[:8]}: {data.get('embeddings_subidos')} embeddings subidos")
            else:
                logger.warning(f"Empleado {emp_id[:8]} no se subió: {data.get('error')}")
        except Exception as e:
            logger.warning(f"Error subiendo empleado {emp_id[:8]}: {e}")

    if success > 0:
        total_emb = sum(len(v) for v in grouped.values())
        logger.info(f"Embeddings subidos a Supabase: {success}/{len(grouped)} empleados ({total_emb} embeddings)")
    return success > 0


def _mark_employees_enrolled(sb, employee_ids: list):
    """
    Marca empleados como enrollados en Supabase después de generar embedding.
    """
    if not employee_ids:
        return
    try:
        for emp_id in employee_ids:
            sb.table("empleados").update({"enrollado": True}).eq("id", emp_id).execute()
        logger.info(f"Empleados marcados como enrollados: {len(employee_ids)}")
    except Exception as e:
        logger.warning(f"Error marcando empleados como enrollados: {e}")


def _reload_matchers(cache_dir: Path):
    """Fuerza recarga de los matchers con el nuevo caché."""
    try:
        import utils.hybrid_opencv_gemini_matcher as hm
        import utils.photo_to_photo_matcher as pm
        # Reset singletons para que usen el nuevo cache_dir
        hm._hybrid_matcher = None
        pm._photo_matcher = None
        hm.get_hybrid_matcher(database_dir=cache_dir)
        pm.get_photo_matcher(database_dir=cache_dir)
    except Exception as e:
        logger.warning(f"No se pudieron recargar matchers: {e}")


class SyncManager(QObject):
    """
    Gestor principal de sincronización.
    Crea y coordina el SyncWorker + timer periódico.
    """

    sync_done    = pyqtSignal(int)
    sync_error   = pyqtSignal(str)
    sync_started = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._worker: Optional[SyncWorker] = None
        self._timer: Optional[QTimer] = None
        self._last_sync: float = 0.0

    def start(self):
        """Arranca el sync inmediato + timer periódico cada 4 horas."""
        self._run_sync()
        self._timer = QTimer(self)
        self._timer.setInterval(SYNC_INTERVAL_MS)
        self._timer.timeout.connect(self._run_sync)
        self._timer.start()

    def force_sync(self):
        """Fuerza sincronización inmediata (llamado desde botón panel supervisor o comando Realtime)."""
        self._run_sync()

    def _run_sync(self):
        if self._worker and self._worker.isRunning():
            return
        self._worker = SyncWorker()
        self._worker.sync_started.connect(self.sync_started)
        self._worker.sync_done.connect(self._on_done)
        self._worker.sync_error.connect(self._on_error)
        self._worker.start()

    def _on_done(self, count: int):
        self._last_sync = time.time()
        self.sync_done.emit(count)

    def _on_error(self, msg: str):
        _log_to_supabase("sync_error", {"error": msg})
        # Notificar al panel para que el admin lo vea sin entrar a logs
        _notify_panel(
            tipo="station_sync_error",
            severidad="error",
            titulo="Error de sincronización en estación",
            mensaje=msg[:200] if msg else "Sin detalle",
            dedupe_key=f"sync-error:{StationInfo.dispositivo_id or 'unknown'}",
        )
        self.sync_error.emit(msg)

    def stop(self):
        """Detiene el timer periódico y espera a que el worker activo termine.

        IMPORTANTE: QTimer.stop() debe llamarse desde el thread donde el
        timer vive (afinidad de QObject). Si stop() se invoca desde otro
        thread (ej. atexit handler) sale el warning
        'Timers cannot be stopped from another thread'. Usamos
        QMetaObject.invokeMethod con Qt.QueuedConnection para encolar
        el stop al hilo correcto.
        """
        if self._timer is not None:
            try:
                from PyQt5.QtCore import QMetaObject, Qt, QThread
                # Si ya estamos en el hilo del timer, llamada directa
                if QThread.currentThread() == self._timer.thread():
                    self._timer.stop()
                else:
                    QMetaObject.invokeMethod(self._timer, "stop", Qt.QueuedConnection)
            except Exception:
                pass
            self._timer = None
        if self._worker and self._worker.isRunning():
            self._worker.quit()
            self._worker.wait(3000)

    def get_cache_dir(self) -> Optional[Path]:
        """Retorna el directorio de caché de la empresa actual."""
        empresa_id = StationInfo.empresa_id
        if not empresa_id:
            return None
        return _get_cache_dir(empresa_id)


# Singleton global
_sync_manager: Optional[SyncManager] = None


def get_sync_manager() -> SyncManager:
    global _sync_manager
    if _sync_manager is None:
        _sync_manager = SyncManager()
    return _sync_manager
