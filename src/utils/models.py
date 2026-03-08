"""
Modelos de base de datos.
Crea los modelos directamente para evitar problemas de imports relativos.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from utils.database import Base


class Trabajador(Base):
    __tablename__ = "trabajadores"

    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    nombre = Column(String, nullable=False)
    apellido = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    activo = Column(Boolean, default=True)
    fecha_registro = Column(DateTime, default=datetime.now)

    # Campos adicionales para gestión de sucursales
    zona = Column(String, nullable=True, index=True)  # CDMX, EDO DE MÉXICO, etc.
    sucursal = Column(String, nullable=True, index=True)  # Nombre de la sucursal
    puesto = Column(String, nullable=True)  # GERENTE, SUPERVISOR, ASESORA, etc.
    employee_id = Column(Integer, nullable=True, index=True)  # ID del empleado del CSV

    # Foto del trabajador
    foto_path = Column(String, nullable=True)  # Ruta a la foto del trabajador

    # Relación con embeddings (usando el índice del sistema principal)
    embedding_idx = Column(
        Integer, nullable=True
    )  # Índice en embeddings_empleados del sistema principal

    # Relación con registros de asistencia
    registros = relationship("RegistroAsistencia", back_populates="trabajador")


class RegistroAsistencia(Base):
    __tablename__ = "registros_asistencia"

    id = Column(Integer, primary_key=True, index=True)
    trabajador_id = Column(Integer, ForeignKey("trabajadores.id"), nullable=False)
    tipo = Column(String, nullable=False)  # 'entrada' o 'salida'
    timestamp = Column(DateTime, default=datetime.now, nullable=False)
    reconocimiento_facial = Column(Boolean, default=True)  # Si fue reconocido por cara
    confianza = Column(Float, nullable=True)  # Confianza del reconocimiento (0-1)
    ubicacion = Column(String, nullable=True)  # Ubicación del registro
    notas = Column(String, nullable=True)

    # Relación con trabajador
    trabajador = relationship("Trabajador", back_populates="registros")


__all__ = ["Trabajador", "RegistroAsistencia"]
