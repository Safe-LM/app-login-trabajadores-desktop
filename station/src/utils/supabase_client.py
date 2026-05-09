import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
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


def _find_and_load_env():
    """Busca el .env, si no existe lo crea desde la config embebida."""
    base = _get_base_dir()
    env_path = base / ".env"

    if not env_path.exists():
        # Buscar config embebida (dentro del .exe o en desarrollo)
        bundled_candidates = [
            base / "config" / "server.env",           # .exe (PyInstaller)
            Path(__file__).resolve().parent.parent / "config" / "server.env",  # desarrollo
        ]
        for bundled in bundled_candidates:
            if bundled.exists():
                logger.info(f"Creando .env desde config embebida: {bundled}")
                import shutil
                shutil.copy2(str(bundled), str(env_path))
                break
        else:
            logger.warning("No se encontró config embebida ni .env existente")

    if env_path.exists():
        load_dotenv(env_path, override=True)
    else:
        logger.warning("No se encontró archivo .env")


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
