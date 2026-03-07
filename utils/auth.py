"""
Utilidades de autenticación con protección contra fuerza bruta.
"""
import time
import logging
import bcrypt
from utils.models import Trabajador
from utils.database import get_db_session

logger = logging.getLogger(__name__)

_failed_attempts: dict[str, list[float]] = {}
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60


def _is_locked_out(username: str) -> bool:
    """Verificar si el usuario está bloqueado por intentos fallidos."""
    attempts = _failed_attempts.get(username, [])
    cutoff = time.time() - LOCKOUT_SECONDS
    recent = [t for t in attempts if t > cutoff]
    _failed_attempts[username] = recent
    return len(recent) >= MAX_ATTEMPTS


def _record_failed_attempt(username: str):
    _failed_attempts.setdefault(username, []).append(time.time())


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar contraseña contra hash bcrypt."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except (ValueError, TypeError):
        return False


def authenticate_user(username: str, password: str) -> Trabajador | None:
    """Autenticar usuario con protección contra fuerza bruta."""
    if _is_locked_out(username):
        logger.warning(f"Usuario '{username}' bloqueado temporalmente por intentos fallidos")
        return None

    db = get_db_session()
    try:
        trabajador = db.query(Trabajador).filter(Trabajador.usuario == username).first()
        if not trabajador or not trabajador.activo:
            _record_failed_attempt(username)
            return None
        if not verify_password(password, trabajador.password_hash):
            _record_failed_attempt(username)
            return None
        _failed_attempts.pop(username, None)
        return trabajador
    finally:
        db.close()

