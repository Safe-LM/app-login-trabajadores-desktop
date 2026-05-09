"""
Database — SQLAlchemy 2.0 Modern API.

Connection pooling, auto-migration, and typed session management.

Usage:
    from utils.database import get_session, engine, Base
    with get_session() as db:
        ...
"""

import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase


# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_DIR = PROJECT_ROOT / "data" / "db"
DB_PATH = DB_DIR / "trabajadores.db"

DB_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

# ── Engine with pooling ─────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    """Enable WAL mode + foreign keys on every connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


# ── Session factory ─────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


# ── Declarative Base ────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Context-managed session ─────────────────────────────────────────────────
@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Typed, auto-closing DB session via context manager.

    with get_session() as db:
        emp = db.scalar(select(Trabajador).where(Trabajador.id == 1))
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_raw_session() -> Session:
    """Raw session — caller is responsible for .close(). Prefer get_session()."""
    return SessionLocal()


def get_db_session() -> Session:
    """Alias compatible con dashboard_window — devuelve session cruda."""
    return SessionLocal()


# ── Auto-migration ──────────────────────────────────────────────────────────
def _migrate_sqlite():
    import sqlite3
    if not DB_PATH.exists():
        return
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    migrations = [
        ("trabajadores", "enrollado", "BOOLEAN DEFAULT 0"),
        ("trabajadores", "zona", "VARCHAR"),
        ("trabajadores", "sucursal", "VARCHAR"),
        ("trabajadores", "puesto", "VARCHAR"),
        ("trabajadores", "employee_id", "INTEGER"),
        ("trabajadores", "foto_path", "VARCHAR"),
        ("trabajadores", "embedding_idx", "INTEGER"),
        ("registros_asistencia", "sincronizado", "BOOLEAN DEFAULT 0"),
    ]
    for table, col, col_def in migrations:
        cur.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in cur.fetchall()}
        if col not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
    conn.commit()
    conn.close()


_migrate_sqlite()


def init_db() -> None:
    """Crea tablas faltantes y aplica migraciones de columnas en SQLite local."""
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
