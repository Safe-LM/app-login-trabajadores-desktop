"""
Configuración de Gemini API Key.
La key se lee desde la variable de entorno GEMINI_API_KEY o desde un archivo .env
"""

import os
from pathlib import Path

GEMINI_API_KEY = ""


def _load_from_dotenv():
    """Cargar API key desde archivo .env si existe."""
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key == "GEMINI_API_KEY" and value:
                    return value
    except Exception:
        return None
    return None


def get_gemini_api_key():
    """
    Obtener API key de Gemini.
    Prioridad:
    1. Variable de entorno GEMINI_API_KEY
    2. Archivo .env en el directorio del proyecto
    """
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key:
        return env_key

    dotenv_key = _load_from_dotenv()
    if dotenv_key:
        return dotenv_key

    return None
