import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cargar variables de entorno
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_supabase: Client = None

def get_supabase_client() -> Client:
    """
    Obtiene el cliente singleton de Supabase.
    """
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("❌ SUPABASE_URL o SUPABASE_KEY no configurados en el archivo .env")
            return None
        
        try:
            _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
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
