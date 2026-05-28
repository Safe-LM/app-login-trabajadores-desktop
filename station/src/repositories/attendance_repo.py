"""
AttendanceRepository — SQLAlchemy 2.0 typed queries.

Uses context-managed sessions. All methods are pure data access — no UI/business logic.
"""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import and_, func, select

from utils.database import get_session
from utils.models import RegistroAsistencia, Trabajador


class AttendanceRepository:
    """Typed access to trabajadores and registros_asistencia tables."""

    # ── Employee queries ──────────────────────────────────────────────────

    @staticmethod
    def get_trabajador_by_employee_id(employee_id: int) -> Optional[Trabajador]:
        with get_session() as db:
            stmt = select(Trabajador).where(Trabajador.employee_id == employee_id)
            return db.scalar(stmt)

    @staticmethod
    def get_trabajador_by_id(trabajador_id: int) -> Optional[Trabajador]:
        with get_session() as db:
            return db.scalar(select(Trabajador).where(Trabajador.id == trabajador_id))

    @staticmethod
    def get_or_create_trabajador(
        employee_id: int,
        nombre: str,
        apellido: str = "",
        sucursal: str = "N/A",
        zona: str = "N/A",
        puesto: str = "N/A",
    ) -> Trabajador:
        uuid_str = str(employee_id)
        is_uuid = isinstance(employee_id, str) and not uuid_str.isdigit() and "-" in uuid_str
        with get_session() as db:
            trab = db.scalar(
                select(Trabajador).where(Trabajador.employee_id == employee_id)
            )
            if trab:
                if is_uuid and not trab.supabase_uuid:
                    trab.supabase_uuid = uuid_str
                return trab
            parts = nombre.split()
            first_name = parts[0] if parts else "Empleado"
            last_name = " ".join(parts[1:]) if len(parts) > 1 else apellido
            trab = Trabajador(
                usuario=f"emp_{employee_id}",
                password_hash="",
                nombre=first_name,
                apellido=last_name or "",
                sucursal=sucursal,
                zona=zona,
                puesto=puesto,
                employee_id=employee_id,
                supabase_uuid=uuid_str if is_uuid else None,
                activo=True,
            )
            db.add(trab)
            db.flush()
            return trab

    # ── Attendance queries ────────────────────────────────────────────────

    @staticmethod
    def get_last_today(trabajador_id: int) -> Optional[RegistroAsistencia]:
        with get_session() as db:
            hoy = date.today()
            stmt = (
                select(RegistroAsistencia)
                .where(
                    and_(
                        RegistroAsistencia.trabajador_id == trabajador_id,
                        func.date(RegistroAsistencia.timestamp) == hoy,
                    )
                )
                .order_by(RegistroAsistencia.timestamp.desc())
            )
            return db.scalar(stmt)

    @staticmethod
    def register_attendance(
        trabajador_id: int,
        tipo: str,
        confianza: float = 0.0,
        ubicacion: str = "N/A",
        metodo: str = "",
    ) -> RegistroAsistencia:
        with get_session() as db:
            registro = RegistroAsistencia(
                trabajador_id=trabajador_id,
                timestamp=datetime.now(),
                tipo=tipo,
                confianza=confianza,
                ubicacion=ubicacion,
                notas=metodo or "",
                reconocimiento_facial=True,
                sincronizado=False,
            )
            db.add(registro)
            db.flush()
            return registro

    @staticmethod
    def mark_synced(registro_id: int) -> None:
        with get_session() as db:
            registro = db.scalar(
                select(RegistroAsistencia).where(
                    RegistroAsistencia.id == registro_id
                )
            )
            if registro:
                registro.sincronizado = True

    @staticmethod
    def get_pending_sync(limit: int = 50) -> list[RegistroAsistencia]:
        with get_session() as db:
            stmt = (
                select(RegistroAsistencia)
                .where(RegistroAsistencia.sincronizado == False)  # noqa: E712
                .order_by(RegistroAsistencia.timestamp.asc())
                .limit(limit)
            )
            return list(db.scalars(stmt))

    @staticmethod
    def get_today_count() -> int:
        with get_session() as db:
            hoy = date.today()
            stmt = select(func.count(RegistroAsistencia.id)).where(
                func.date(RegistroAsistencia.timestamp) == hoy
            )
            return db.scalar(stmt) or 0

    @staticmethod
    def get_today_by_tipo() -> dict[str, int]:
        with get_session() as db:
            hoy = date.today()
            stmt = (
                select(
                    RegistroAsistencia.tipo,
                    func.count(RegistroAsistencia.id),
                )
                .where(func.date(RegistroAsistencia.timestamp) == hoy)
                .group_by(RegistroAsistencia.tipo)
            )
            rows = db.execute(stmt).all()
            return {row[0]: row[1] for row in rows}

    @staticmethod
    def get_recent(limit: int = 10) -> list[dict]:
        with get_session() as db:
            stmt = (
                select(RegistroAsistencia, Trabajador.nombre, Trabajador.apellido)
                .join(Trabajador)
                .order_by(RegistroAsistencia.timestamp.desc())
                .limit(limit)
            )
            rows = db.execute(stmt).all()
            return [
                {
                    "tipo": r.tipo,
                    "hora": r.timestamp.strftime("%H:%M:%S"),
                    "nombre": f"{nombre} {apellido}".strip(),
                }
                for r, nombre, apellido in rows
            ]
