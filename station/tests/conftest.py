"""
Shared pytest fixtures for Safe Link Monitoring Station tests.
"""

import sys
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

import pytest
from unittest.mock import MagicMock, patch

from utils.database import Base, engine, SessionLocal
from utils.models import Trabajador, RegistroAsistencia


@pytest.fixture(scope="function")
def db_session():
    """In-memory SQLite session with clean tables per test."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
        db.rollback()
    finally:
        # Clean up all rows
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        db.close()


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    client.rpc.return_value.execute.return_value.data = {"ok": True}
    return client


@pytest.fixture
def sample_trabajador(db_session):
    """Create a test employee in the database."""
    # Check if already exists from previous fixture sharing
    from sqlalchemy import select
    existing = db_session.scalar(
        select(Trabajador).where(Trabajador.employee_id == 1001)
    )
    if existing:
        return existing

    trab = Trabajador(
        usuario="emp_1001",
        password_hash="test_hash",
        nombre="Juan",
        apellido="Perez",
        employee_id=1001,
        zona="Norte",
        sucursal="Sucursal A",
        puesto="Operador",
        activo=True,
    )
    db_session.add(trab)
    db_session.commit()
    return trab


@pytest.fixture
def sample_recognition_result():
    """Typical recognition result from face matcher."""
    from services.dto import RecognitionResult
    return RecognitionResult(
        recognized=True,
        confidence=0.92,
        employee_id=1001,
        nombre="Juan",
        apellido="Perez",
        zona="Norte",
        sucursal="Sucursal A",
        puesto="Operador",
        method="OpenCV",
    )


@pytest.fixture
def sample_attendance_record():
    """Typical attendance record."""
    from services.dto import AttendanceRecord
    return AttendanceRecord(
        trabajador_id=1,
        tipo="entrada",
        confianza=0.92,
        nombre="Juan Perez",
        ubicacion="Sucursal A",
        metodo="OpenCV",
    )
