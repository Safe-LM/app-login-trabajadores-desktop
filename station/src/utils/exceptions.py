"""
Custom exception hierarchy for Safe Link Monitoring Station.

Usage:
    from utils.exceptions import CameraError, RecognitionError, SupabaseError
    raise CameraError("No se pudo abrir la cámara", camera_index=0)
"""

from typing import Optional


class StationError(Exception):
    """Base exception for all station errors."""
    def __init__(self, message: str, *, details: str = ""):
        super().__init__(message)
        self.details = details


class CameraError(StationError):
    """Camera access/read failures."""
    def __init__(self, message: str, *, camera_index: int = 0, details: str = ""):
        super().__init__(message, details=details)
        self.camera_index = camera_index


class RecognitionError(StationError):
    """Face recognition system errors."""
    def __init__(self, message: str, *, method: str = "", details: str = ""):
        super().__init__(message, details=details)
        self.method = method


class SupabaseError(StationError):
    """Supabase communication failures."""
    def __init__(self, message: str, *, rpc_function: str = "", details: str = ""):
        super().__init__(message, details=details)
        self.rpc_function = rpc_function


class DatabaseError(StationError):
    """Local database failures."""
    pass


class SyncError(StationError):
    """Employee sync failures."""
    def __init__(self, message: str, *, empresa_id: str = "", details: str = ""):
        super().__init__(message, details=details)
        self.empresa_id = empresa_id


class ConfigError(StationError):
    """Configuration/pairing errors."""
    pass


__all__ = [
    "StationError",
    "CameraError",
    "RecognitionError",
    "SupabaseError",
    "DatabaseError",
    "SyncError",
    "ConfigError",
]
