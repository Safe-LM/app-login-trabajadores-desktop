"""
Unit tests for AttendanceService — business logic.
"""

import pytest
from unittest.mock import patch

from services.attendance_service import (
    determine_tipo, is_in_cooldown, register_local,
    sync_to_supabase, flush_offline_queue,
    get_today_stats, get_recent_activity,
)
from services.dto import RecognitionResult
from repositories.attendance_repo import AttendanceRepository

_repo = AttendanceRepository()


class TestDetermineTipo:

    def test_first_entry_is_entrada(self, sample_trabajador):
        assert determine_tipo(sample_trabajador.id) == "entrada"

    def test_second_is_salida(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id, tipo="entrada", confianza=0.9,
        )
        assert determine_tipo(sample_trabajador.id) == "salida"

    def test_third_is_entrada(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id, tipo="entrada", confianza=0.9,
        )
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id, tipo="salida", confianza=0.9,
        )
        assert determine_tipo(sample_trabajador.id) == "entrada"


class TestCooldown:

    def test_no_cooldown_first_time(self, sample_trabajador):
        blocked, detail = is_in_cooldown(sample_trabajador.id)
        assert not blocked
        assert detail is None

    def test_cooldown_active(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id, tipo="entrada", confianza=0.9,
        )
        blocked, detail = is_in_cooldown(sample_trabajador.id)
        assert blocked
        assert detail is not None
        assert detail["tipo"] == "entrada"


class TestRegisterLocal:

    def test_register_new_employee(self, sample_recognition_result):
        record = register_local(sample_recognition_result)
        assert record is not None
        assert record.tipo in ("entrada", "salida")
        assert record.confianza == 0.92

    @pytest.mark.parametrize("confianza", [0.85, 0.90, 0.95, 1.0])
    def test_various_confidences(self, confianza, sample_trabajador):
        result = RecognitionResult(
            recognized=True, confidence=confianza,
            employee_id=1001, nombre="Juan", apellido="Perez",
        )
        record = register_local(result)
        assert record.confianza == confianza


class TestSyncToSupabase:

    def test_sync_no_api_key(self, sample_attendance_record):
        with patch("utils.station_manager.get_station_api_key", return_value=None):
            assert sync_to_supabase(sample_attendance_record) == False

    def test_sync_no_supabase_client(self, sample_attendance_record):
        with patch("utils.station_manager.get_station_api_key", return_value="key"):
            with patch("utils.supabase_client.get_supabase_client", return_value=None):
                assert sync_to_supabase(sample_attendance_record) == False


class TestStats:

    def test_empty_stats(self, db_session):
        stats = get_today_stats()
        assert stats["total"] == 0
        assert stats["entradas"] == 0
        assert stats["salidas"] == 0

    def test_stats_with_data(self, sample_trabajador):
        _repo.register_attendance(
            trabajador_id=sample_trabajador.id, tipo="entrada", confianza=0.9,
        )
        stats = get_today_stats()
        assert stats["total"] >= 1
        assert stats["entradas"] >= 1

    def test_recent_activity_empty(self, db_session):
        recs = get_recent_activity()
        assert isinstance(recs, list)
