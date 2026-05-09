"""
Autenticación local con bcrypt + lockout anti brute-force persistido en SQLite.

`authenticate_user` cuenta los intentos fallidos en `auth_lockouts` dentro
de la ventana `LOCKOUT_SECONDS`. Si llega a `MAX_ATTEMPTS`, devuelve None
y emite WARNING. Reiniciar el proceso ya no resetea el contador (ese fue
el bug de la versión in-memory).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import bcrypt

from utils.database import get_db_session
from utils.models import AuthLockout, Trabajador

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60


def _is_locked_out(db, username: str) -> bool:
    cutoff = datetime.now() - timedelta(seconds=LOCKOUT_SECONDS)
    recientes = (
        db.query(AuthLockout)
        .filter(AuthLockout.usuario == username, AuthLockout.timestamp > cutoff)
        .count()
    )
    return recientes >= MAX_ATTEMPTS


def _record_failed_attempt(db, username: str, ip: Optional[str] = None) -> None:
    db.add(AuthLockout(usuario=username, ip=ip))
    db.commit()


def _clear_attempts(db, username: str) -> None:
    db.query(AuthLockout).filter(AuthLockout.usuario == username).delete()
    db.commit()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def authenticate_user(
    username: str, password: str, ip: Optional[str] = None
) -> Optional[Trabajador]:
    """Devuelve Trabajador autenticado o None.

    None puede significar: usuario inexistente, credenciales inválidas o
    lockout temporal — desde el punto de vista del cliente las tres son
    equivalentes (no se filtra qué falló).
    """
    db = get_db_session()
    try:
        if _is_locked_out(db, username):
            logger.warning("Usuario '%s' bloqueado por intentos fallidos", username)
            return None

        trab = db.query(Trabajador).filter(Trabajador.usuario == username).first()
        if not trab or not trab.activo:
            _record_failed_attempt(db, username, ip)
            return None

        if not verify_password(password, trab.password_hash):
            _record_failed_attempt(db, username, ip)
            return None

        _clear_attempts(db, username)
        return trab
    finally:
        db.close()


__all__ = [
    "authenticate_user",
    "verify_password",
    "MAX_ATTEMPTS",
    "LOCKOUT_SECONDS",
]
