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
            except Exception as ex:
                logger.warning(f"No se pudo descargar foto de {emp_id}: {ex}")
                emp["foto_local"] = ""

    # 4. Guardar employees.json actualizado
    json_path.write_text(json.dumps(empleados, ensure_ascii=False, indent=2), "utf-8")

    # 5. Intentar descargar embeddings desde Supabase (pgvector)
    embeddings_updated = _download_embeddings_from_supabase(sb, empresa_id, cache_dir, empleados)

    # 6. Si no hay embeddings de Supabase, generar localmente
    # Trigger: hay fotos nuevas, O hay empleados sin enrollar (enrollado=false)
    new_encodings = 0
    no_enrollados = [e for e in empleados if not e.get("enrollado", False) and e.get("foto_local")]
    if not embeddings_updated and (new_photos > 0 or no_enrollados):
        if no_enrollados and new_photos == 0:
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

    Returns:
        True si se descargaron embeddings, False si no hay o fallaron
    """
    try:
        encodings_file = cache_dir / "face_encodings_opencv.pkl"

        result = sb.table("embeddings_faciales").select(
            "empleado_id, embedding"
        ).eq("empresa_id", empresa_id).execute()

        if not result.data:
            logger.info("No hay embeddings en Supabase para esta empresa")
            return False

        emp_map = {str(emp["id"]): emp for emp in empleados}

        encodings = []
        employee_ids = []
        employee_info = {}

        for row in result.data:
            emp_id = str(row["empleado_id"])
            emb = row["embedding"]

            if isinstance(emb, str):
                import numpy as np
                emb = np.array(json.loads(emb))
            elif isinstance(emb, list):
                import numpy as np
                emb = np.array(emb)

            encodings.append(emb)
            employee_ids.append(emp_id)

            emp_data = emp_map.get(emp_id, {})
            employee_info[emp_id] = {
                "employee_id": emp_id,
                "nombre": emp_data.get("nombre", "Unknown"),
                "apellido": emp_data.get("apellido", ""),
                "puesto": emp_data.get("puesto", ""),
                "sucursal": emp_data.get("sucursal_nombre", ""),
            }

        if not encodings:
            return False

        # Detectar si vienen augmented (más de 1 por empleado)
        unique_emps = len(set(employee_ids))
        is_augmented = len(encodings) > unique_emps

        data = {
            "encodings": encodings,
            "employee_ids": employee_ids,
            "augmented": is_augmented,
            "version": 3,
            "source": "supabase",
        }

        with open(encodings_file, "wb") as f:
            pickle.dump(data, f)

        logger.info(
            f"Embeddings descargados de Supabase: {unique_emps} empleados, "
            f"{len(encodings)} embeddings"
            f"{' (augmented)' if is_augmented else ''}"
        )
        return True

    except Exception as e:
        logger.warning(f"Error descargando embeddings de Supabase: {e}")
        return False


def _augment_image(frame):
    """
    Genera 10 variaciones por foto siguiendo el approach del v3 SFace original.
    Esto pasa la precisión de ~85% con 1 embedding a ~99% con 10.
    Variaciones: original, flip H, 4 brillo/contraste, 2 rotaciones, ruido, blur.
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

        for foto_path in photos_dir.iterdir():
            if foto_path.suffix.lower() not in extensions:
                continue

            emp_id = foto_path.stem

            try:
                frame = cv2.imread(str(foto_path))
                if frame is None:
                    empleados_fallidos += 1
                    continue

                # Generar 10 variaciones de la foto
                variants = _augment_image(frame)
                emb_count = 0

                for variant in variants:
                    h, w = variant.shape[:2]
                    detector.setInputSize((w, h))
                    _, faces = detector.detect(variant)

                    if faces is None or len(faces) == 0:
                        continue

                    # Tomar la cara con mayor score
                    face_info = faces[np.argmax(faces[:, -1])]
                    aligned = recognizer.alignCrop(variant, face_info)
                    embedding = recognizer.feature(aligned).flatten()

                    encodings.append(embedding)
                    employee_ids.append(emp_id)
                    emb_count += 1

                if emb_count > 0:
                    empleados_procesados += 1
                    logger.debug(f"  [{emp_id[:8]}] {emb_count}/10 embeddings (augmented)")
                else:
                    empleados_fallidos += 1
                    logger.debug(f"Sin rostro detectado en ninguna variante: {foto_path.name}")

            except Exception as e:
                empleados_fallidos += 1
                logger.debug(f"Error con {foto_path.name}: {e}")
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
        return encodings, employee_ids

    except Exception as e:
        logger.warning(f"No se pudieron regenerar encodings: {e}")
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
        """Detiene el timer periódico y espera a que el worker activo termine."""
        if self._timer is not None:
            try:
                self._timer.stop()
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
