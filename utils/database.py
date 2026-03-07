"""
Utilidades para manejo de base de datos.
Comparte la misma base de datos que la aplicación web.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

# Obtener la ruta de la base de datos compartida
BASE_DIR = Path(__file__).parent.parent.parent
DB_PATH = BASE_DIR / "app_loginTrabajadores" / "database" / "trabajadores.db"

# Si no existe, usar una local
if not DB_PATH.exists():
    DB_DIR = Path(__file__).parent.parent / "database"
    DB_DIR.mkdir(exist_ok=True)
    DB_PATH = DB_DIR / "trabajadores.db"

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Crear engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Session:
    """Obtener sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_session() -> Session:
    """Obtener una sesión de base de datos directamente."""
    return SessionLocal()

