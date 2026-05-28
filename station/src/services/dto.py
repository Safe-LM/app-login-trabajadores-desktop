"""
Data Transfer Objects — typed data between services and UI.

All fields are read-only. Use dataclasses for automatic __init__, __repr__, __eq__.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class RecognitionResult:
    """Result of a single face recognition attempt."""
    recognized: bool
    confidence: float
    employee_id: int = 0
    nombre: str = ""
    apellido: str = ""
    zona: str = "N/A"
    sucursal: str = "N/A"
    puesto: str = "N/A"
    method: str = ""
    avatar_b64: str = ""


@dataclass(frozen=True)
class AttendanceRecord:
    """Confirmed attendance registration."""
    trabajador_id: int
    tipo: str
    confianza: float
    timestamp: datetime = field(default_factory=datetime.now)
    nombre: str = ""
    apellido: str = ""
    ubicacion: str = "N/A"
    metodo: str = ""
    cloud_synced: bool = False
    registro_id: int = 0
    supabase_uuid: str = ""


@dataclass(frozen=True)
class StationHealth:
    """System health snapshot."""
    score: int = 0
    camara_ok: Optional[bool] = None
    empleados_count: int = 0
    encodings_count: int = 0
    matchers_enabled: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RecentActivity:
    """Single activity record for the UI list."""
    nombre: str
    tipo: str
    hora: str
