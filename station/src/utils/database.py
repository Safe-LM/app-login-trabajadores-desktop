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
# La BD SQLite local DEBE vivir en una ruta escribible. En dev local
# resuelve a station/data/db/. En el .exe instalado (--onedir en
# C:\Program Files\) sin esto resolvia a la ruta read-only de la
# instalacion -> tabla 'trabajadores' nunca se creaba -> error
# "no such table" al intentar registrar asistencia tras un match.
try:
    from utils.paths import writable_root

    DB_DIR = writable_root() / "data" / "db"
except Exception:
    # Fallback solo si paths.py no esta disponible (ej. tests aislados)
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
    """Aplica migraciones de columnas sobre tablas existentes.

    Solo opera sobre tablas que YA fueron creadas por SQLAlchemy
    (create_all). Si PRAGMA table_info devuelve filas vacias significa
    que la tabla no existe — saltamos en silencio en vez de intentar
    ALTER TABLE y petar con "no such table".
    """
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
        # A7: telemetria de calidad del reconocimiento (cosine real,
        # metodo usado, conteo de embeddings). Sin estas columnas el
        # modelo SQLAlchemy peta al cargar registros_asistencia.
        ("registros_asistencia", "score_raw", "REAL"),
        ("registros_asistencia", "metodo", "VARCHAR"),
        ("registros_asistencia", "embedding_count", "INTEGER"),
    ]

    # Cache de existencia de tabla para no chequear repetidamente
    table_exists_cache: dict[str, bool] = {}

    def _table_exists(name: str) -> bool:
        if name in table_exists_cache:
            return table_exists_cache[name]
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (name,),
        )
        exists = cur.fetchone() is not None
        table_exists_cache[name] = exists
        return exists

    for table, col, col_def in migrations:
        if not _table_exists(table):
            # Tabla aun no creada — create_all() la hara en init_db().
            # Skipear evita "no such table: trabajadores" cuando la BD
            # es nueva y _migrate_sqlite corre antes de create_all.
            continue
        cur.execute(f"PRAGMA table_info({table})")
        existing = {row[1] for row in cur.fetchall()}
        if col not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
    conn.commit()
    conn.close()


# IMPORTANTE: NO llamamos _migrate_sqlite() aqui al importar el modulo.
# Esto causaba el bug "no such table: trabajadores" en BD nueva:
#  - import database.py -> _migrate_sqlite() corre -> BD no existe -> return
#  - despues init_db() crea las tablas, pero la migracion ya corrio
#  - cuando algo intenta INSERT sin las columnas nuevas -> error
# init_db() ahora orquesta el orden correcto: primero create_all,
# luego _migrate_sqlite().


def init_db() -> None:
    """Crea tablas faltantes y aplica migraciones de columnas en SQLite local.

    IMPORTANTE: importamos utils.models AQUI dentro para forzar el
    registro de las clases ORM (Trabajador, RegistroAsistencia) en
    Base.metadata ANTES de llamar create_all. Sin este import, Base
    queda vacio y create_all no crea ninguna tabla — silenciosamente.

    Eso causaba en produccion el error "no such table: trabajadores"
    porque la BD se creaba como archivo vacio sin schema, y el primer
    INSERT desde _auto_register fallaba.
    """
    # Forzar registro de modelos en Base.metadata
    from utils import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
