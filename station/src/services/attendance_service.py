"""
AttendanceService — orchestrate local DB + Supabase registration.

Pure business logic. No PyQt dependencies.
"""

import logging
from datetime import date, datetime
from typing import Optional

from repositories.attendance_repo import AttendanceRepository
from services.dto import AttendanceRecord, RecognitionResult
from utils.exceptions import DatabaseError, SupabaseError

logger = logging.getLogger(__name__)

_repo = AttendanceRepository()

# Cooldown: same employee can't register again within N seconds
REGISTRATION_COOLDOWN_SECONDS = 60
# Cooldown: any recognition reset for UI
RECOGNITION_RESET_SECONDS = 3.0


def determine_tipo(trabajador_id: int) -> str:
    """Decide 'entrada' or 'salida' based on last today's record."""
    ultimo = _repo.get_last_today(trabajador_id)
    if ultimo and ultimo.tipo == "entrada":
        return "salida"
    return "entrada"


def is_in_cooldown(trabajador_id: int) -> tuple[bool, Optional[dict]]:
    """Check if this employee registered within the cooldown window.

    Returns (is_blocked, details).
    """
    ultimo = _repo.get_last_today(trabajador_id)
    if not ultimo:
        return False, None
    seconds_since = (datetime.now() - ultimo.timestamp).total_seconds()
    if seconds_since < REGISTRATION_COOLDOWN_SECONDS:
        return True, {
            "tipo": ultimo.tipo,
            "hora": ultimo.timestamp.strftime("%H:%M"),
        }
    return False, None


def get_or_create_trabajador_id(result: RecognitionResult) -> int:
    """Obtiene el ID local del trabajador sin registrar asistencia."""
    trab = _repo.get_or_create_trabajador(
        employee_id=result.employee_id,
        nombre=result.nombre,
        apellido=result.apellido,
        sucursal=result.sucursal,
        zona=result.zona,
        puesto=result.puesto,
    )
    return trab.id


def register_local(result: RecognitionResult) -> AttendanceRecord:
    """Save attendance to SQLite and return the record.

    Raises DatabaseError on failure.
    """
    try:
        trab = _repo.get_or_create_trabajador(
            employee_id=result.employee_id,
            nombre=result.nombre,
            apellido=result.apellido,
            sucursal=result.sucursal,
            zona=result.zona,
            puesto=result.puesto,
        )

        tipo = determine_tipo(trab.id)

        registro = _repo.register_attendance(
            trabajador_id=trab.id,
            tipo=tipo,
            confianza=result.confidence,
            ubicacion=result.sucursal or "N/A",
            metodo=result.method,
        )

        nombre_display = result.nombre or f"{trab.nombre} {trab.apellido}".strip()

        return AttendanceRecord(
            trabajador_id=trab.id,
            registro_id=registro.id,
            supabase_uuid=trab.supabase_uuid or "",
            tipo=tipo,
            confianza=result.confidence,
            timestamp=registro.timestamp,
            nombre=nombre_display,
            apellido=result.apellido or "",
            ubicacion=result.sucursal or "N/A",
            metodo=result.method,
        )
    except Exception as e:
        raise DatabaseError(f"register_local failed: {e}") from e


def sync_to_supabase(record: AttendanceRecord) -> bool:
    """Push attendance to Supabase RPC. Returns True if synced.

    Silently swallows network errors — record stays in offline queue.
    """
    try:
        from utils.station_manager import get_station_api_key
        from utils.supabase_client import get_supabase_client

        api_key = get_station_api_key()
        sb = get_supabase_client()
        if not api_key or not sb:
            return False

        supabase_uuid = record.supabase_uuid
        if not supabase_uuid:
            trab = _repo.get_trabajador_by_id(record.trabajador_id)
            supabase_uuid = trab.supabase_uuid if trab else ""
        if not supabase_uuid:
            return False

        result = sb.rpc("registrar_asistencia_station", {
            "p_api_key": api_key,
            "p_empleado_id": supabase_uuid,
            "p_tipo": record.tipo,
            "p_confianza": float(record.confianza),
            "p_notas": record.metodo or "",
        }).execute()

        if result.data and result.data.get("ok"):
            if record.registro_id:
                _repo.mark_synced(record.registro_id)
            return True
        return False
    except Exception as e:
        logger.debug(f"Supabase sync deferred: {e}")
        return False


def flush_offline_queue() -> int:
    """Push pending records to Supabase. Returns count synced."""
    try:
        from utils.station_manager import get_station_api_key
        from utils.supabase_client import get_supabase_client

        api_key = get_station_api_key()
        sb = get_supabase_client()
        if not api_key or not sb:
            return 0

        pendientes = _repo.get_pending_sync()
        synced = 0
        for reg in pendientes:
            try:
                trab = _repo.get_trabajador_by_id(reg.trabajador_id)
                if not trab or not trab.supabase_uuid:
                    continue
                result = sb.rpc("registrar_asistencia_station", {
                    "p_api_key": api_key,
                    "p_empleado_id": trab.supabase_uuid,
                    "p_tipo": reg.tipo,
                    "p_confianza": float(reg.confianza or 0),
                    "p_score_raw": float(reg.score_raw) if reg.score_raw is not None else None,
                    "p_metodo": reg.metodo,
                    "p_embedding_count": reg.embedding_count,
                }).execute()
                if result.data and result.data.get("ok"):
                    _repo.mark_synced(reg.id)
                    synced += 1
            except Exception:
                pass
        if synced:
            logger.info(f"Offline queue: {synced} registros sincronizados")
        return synced
    except Exception as e:
        logger.error(f"flush_offline_queue error: {e}")
        return 0


def get_today_stats() -> dict:
    """Return today's attendance summary."""
    try:
        total = _repo.get_today_count()
        by_tipo = _repo.get_today_by_tipo()
        return {
            "total": total,
            "entradas": by_tipo.get("entrada", 0),
            "salidas": by_tipo.get("salida", 0),
        }
    except Exception:
        return {"total": 0, "entradas": 0, "salidas": 0}


def get_recent_activity(limit: int = 8) -> list[dict]:
    """Return recent attendance records for the activity panel."""
    try:
        return _repo.get_recent(limit)
    except Exception:
        return []


def get_last_registration_text() -> Optional[str]:
    """Return text for 'last registration today' display."""
    try:
        from utils.database import get_session
        from utils.models import RegistroAsistencia
        from sqlalchemy import func, select

        hoy = date.today()
        with get_session() as db:
            stmt = (
                select(RegistroAsistencia)
                .where(func.date(RegistroAsistencia.timestamp) == hoy)
                .order_by(RegistroAsistencia.timestamp.desc())
            )
            reg = db.scalar(stmt)
            if reg:
                hora = reg.timestamp.strftime("%H:%M:%S")
                return f"{reg.tipo.upper()}  {hora}"
            return "Sin registros hoy"
    except Exception:
        return "Sin registros hoy"
