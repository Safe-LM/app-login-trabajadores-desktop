"""
Unit tests for AttendanceRepository — SQLAlchemy 2.0 queries.
"""

import pytest
from datetime import datetime, date

from repositories.attendance_repo import AttendanceRepository
from utils.models import Trabajador, RegistroAsistencia

_repo = AttendanceRepository()


class TestGetOrCreateTrabajador:

    def test_create_new_employee(self, db_session):
        trab = _repo.get_or_create_trabajador(
            employee_id=9999, nombre="Maria Lopez",
            sucursal="Sucursal B", zona="Sur", puesto="Supervisor",
        )
        assert trab.employee_id == 9999
        assert trab.nombre == "Maria"
        assert trab.apellido == "Lopez"
        assert trab.sucursal == "Sucursal B"

    def test_get_existing_employee(self, sample_trabajador):
        trab = _repo.get_or_create_trabajador(
            employee_id=1001, nombre="Otro Nombre",
        )
        assert trab.employee_id == 1001
        assert trab.nombre == "Juan"

    def test_single_name_employee(self, db_session):
        trab = _repo.get_or_create_trabajador(
            employee_id=5000, nombre="Juan",
        )
        assert trab.nombre == "Juan"
        assert trab.apellido == ""


class TestAttendanceOperations:

    def test_register_attendance(self, sample_trabajador):
        registro = _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.90,
            ubicacion="Sucursal A",
            metodo="OpenCV",
        )
        assert registro is not None
        assert registro.tipo == "entrada"
        assert registro.sincronizado == False  # noqa: E712

    def test_get_last_today(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.88,
        )
        ultimo = _repo.get_last_today(sample_trabajador.id)
        assert ultimo is not None
        assert ultimo.tipo == "entrada"

    def test_mark_synced(self, sample_trabajador):
        registro = _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.90,
        )
        _repo.mark_synced(registro.id)
        # Verify
        ultimo = _repo.get_last_today(sample_trabajador.id)
        assert ultimo.sincronizado == True  # noqa: E712

    def test_get_pending_sync(self, sample_trabajador):
        registro = _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.90,
        )
        pendientes = _repo.get_pending_sync()
        assert len(pendientes) >= 1
        ids = [r.id for r in pendientes]
        assert registro.id in ids


class TestCounts:

    def test_today_count_empty(self, db_session):
        assert _repo.get_today_count() == 0

    def test_today_count_with_data(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.90,
        )
        assert _repo.get_today_count() >= 1

    def test_get_recent(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id,
            tipo="entrada",
            confianza=0.90,
        )
        recent = _repo.get_recent(limit=5)
        assert len(recent) >= 1
        assert "nombre" in recent[0]
        assert "tipo" in recent[0]
        assert "hora" in recent[0]
