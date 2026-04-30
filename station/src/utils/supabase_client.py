import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_supabase: Client = None


def _find_and_load_env():
    """Busca el .env subiendo desde este archivo y lo carga. Siempre busca de nuevo."""
    for _p in Path(__file__).resolve().parents:
        _candidate = _p / ".env"
        if _candidate.exists():
            load_dotenv(_candidate, override=True)
            return
    logger.warning("No se encontró archivo .env en ningún directorio padre")


def get_supabase_client() -> Client:
    global _supabase
    if _supabase is None:
        # Siempre recargar .env antes de leer las variables
        _find_and_load_env()
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            logger.error("❌ SUPABASE_URL o SUPABASE_KEY no configurados en el archivo .env")
            return None
        try:
            _supabase = create_client(url, key)
            logger.info("✅ Conexión con Supabase establecida.")
        except Exception as e:
            logger.error(f"❌ Error al conectar con Supabase: {e}")
            return None
    return _supabase


# Prueba de conexión rápida si se ejecuta directamente
if __name__ == "__main__":
    client = get_supabase_client()
    if client:
        print("¡Conexión exitosa!")
    else:
        print("Fallo en la conexión.")
