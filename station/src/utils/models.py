"""
SQLAlchemy 2.0 models — Safe Link Monitoring Station.

Uses Mapped[T] + mapped_column() typed annotations.
"""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from utils.database import Base


class Trabajador(Base):
    __tablename__ = "trabajadores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    usuario: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    nombre: Mapped[str] = mapped_column(String)
    apellido: Mapped[str] = mapped_column(String)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    enrollado: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    zona: Mapped[Optional[str]] = mapped_column(String, index=True)
    sucursal: Mapped[Optional[str]] = mapped_column(String, index=True)
    puesto: Mapped[Optional[str]] = mapped_column(String)
    employee_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    foto_path: Mapped[Optional[str]] = mapped_column(String)
    embedding_idx: Mapped[Optional[int]] = mapped_column(Integer)

    registros: Mapped[List["RegistroAsistencia"]] = relationship(
        back_populates="trabajador", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Trabajador #{self.id} {self.nombre} {self.apellido}>"


class RegistroAsistencia(Base):
    __tablename__ = "registros_asistencia"
    __table_args__ = (
        Index("idx_asistencia_fecha", func.date("timestamp")),
        Index("idx_asistencia_emp_fecha", "trabajador_id", func.date("timestamp")),
        Index("idx_asistencia_sync", "sincronizado"),
        Index("idx_asistencia_tipo_fecha", "tipo", func.date("timestamp")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trabajador_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trabajadores.id"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now, nullable=False, index=True
    )
    reconocimiento_facial: Mapped[bool] = mapped_column(Boolean, default=True)
    confianza: Mapped[Optional[float]] = mapped_column(Float)
    ubicacion: Mapped[Optional[str]] = mapped_column(String)
    notas: Mapped[Optional[str]] = mapped_column(String)
    sincronizado: Mapped[bool] = mapped_column(Boolean, default=False)
    # A7: telemetria de calidad del reconocimiento facial.
    # score_raw = cosine real (0-1, sin inflar). Antes solo guardabamos
    # el "display_conf" mentiroso, ahora persistimos el valor honesto
    # para auditoria y calibracion futura de umbrales.
    score_raw: Mapped[Optional[float]] = mapped_column(Float)
    metodo: Mapped[Optional[str]] = mapped_column(String)
    embedding_count: Mapped[Optional[int]] = mapped_column(Integer)

    trabajador: Mapped["Trabajador"] = relationship(back_populates="registros")

    def __repr__(self) -> str:
        return f"<Registro {self.tipo} #{self.trabajador_id} @ {self.timestamp}>"


__all__ = ["Trabajador", "RegistroAsistencia"]
