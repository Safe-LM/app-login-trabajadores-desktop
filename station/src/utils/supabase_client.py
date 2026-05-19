import os
import sys
import logging
from pathlib import Path
from dotenv import dotenv_values, load_dotenv
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_supabase: Client = None


def _get_base_dir() -> Path:
    """Retorna el directorio base, funciona tanto en desarrollo como en .exe."""
    if getattr(sys, 'frozen', False):
        # Ejecutando como .exe (PyInstaller)
        return Path(sys.executable).parent
    else:
        # Desarrollo normal
        for _p in Path(__file__).resolve().parents:
            if (_p / ".env").exists():
                return _p
        return Path(__file__).resolve().parent.parent.parent


def _reapply_server_defaults() -> None:
    """
    Rellena SUPABASE_URL/KEY desde el server.env embebido si la carga
    posterior del .env de usuario los dejo vacios. Sin esto, un .env
    legacy con "SUPABASE_KEY=" en blanco rompe la conexion aunque
    _bootstrap_env() haya restaurado los defaults al arranque.
    """
    try:
        from utils.paths import bundled_server_env_path
        server_env = bundled_server_env_path()
        if not server_env.exists():
            return
        for k, v in dotenv_values(server_env).items():
            if v and not os.environ.get(k):
                os.environ[k] = v
    except Exception:
        pass


def _find_and_load_env():
    """Carga el .env desde la ruta escribible (utils/paths.env_path)
    y reaplica los defaults embebidos para evitar que claves vacias
    en el .env del usuario pisen las credenciales del fabricante."""
    try:
        from utils.paths import env_path as _ep
        env_file = _ep()
        if env_file.exists():
            load_dotenv(env_file, override=True)
            _reapply_server_defaults()
            return
    except Exception:
        pass
    # Fallback: buscar en el bundle / dev local
    base = _get_base_dir()
    env_file = base / ".env"
    if env_file.exists():
        load_dotenv(env_file, override=True)
    elif not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_KEY"):
        logger.warning("No se encontró archivo .env")
    _reapply_server_defaults()


def get_supabase_client() -> Client:
    global _supabase
    if _supabase is None:
        _find_and_load_env()
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            logger.error("❌ SUPABASE_URL o SUPABASE_KEY no configurados")
            return None  # No cachear — puede que el .env se escriba después (setup)
        try:
            _supabase = create_client(url, key)
            logger.info("✅ Conexión con Supabase establecida.")
        except Exception as e:
            logger.error(f"❌ Error al conectar con Supabase: {e}")
            return None  # No cachear el fallo
    return _supabase


def reset_supabase_client():
    """Fuerza reinicialización del cliente — útil tras escribir .env en setup."""
    global _supabase
    _supabase = None



# Prueba de conexión rápida si se ejecuta directamente
if __name__ == "__main__":
    client = get_supabase_client()
    if client:
        print("¡Conexión exitosa!")
    else:
        print("Fallo en la conexión.")
