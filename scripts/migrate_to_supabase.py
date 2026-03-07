import os
import sys
from pathlib import Path
import json
import logging

# Añadir src al path para poder importar módulos
root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "src"))

from utils.database import get_db_session
from utils.models import Trabajador
from utils.supabase_client import get_supabase_client
import numpy as np
import pickle

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MigracionSupabase")

def migrate_employees():
    """Migra los empleados locales y sus embeddings a Supabase."""
    sb = get_supabase_client()
    if not sb:
        return

    db = get_db_session()
    trabajadores = db.query(Trabajador).all()
    
    logger.info(f"Encontrados {len(trabajadores)} trabajadores en la base de datos local.")

    # Cargar embeddings locales si existen
    encodings_path = root_dir / "database_fotos" / "face_encodings_opencv.pkl"
    encs_data = {}
    if encodings_path.exists():
        with open(encodings_path, 'rb') as f:
            encs_data = pickle.load(f) # nosec
            logger.info("Encodings locales cargados.")

    for t in trabajadores:
        # Extraer embeddings del empleado si están disponibles
        employee_embs = []
        if encs_data:
            indices = [i for i, eid in enumerate(encs_data.get('employee_ids', [])) if eid == t.employee_id]
            if indices:
                # Tomamos el promedio de sus embeddings para tener un vector representativo o el primero
                relevant_encs = [encs_data['encodings'][i] for i in indices]
                # Supabase maneja float8[], convertimos numpy array a lista
                avg_emb = np.mean(relevant_encs, axis=0).tolist()
                employee_embs = avg_emb

        data = {
            "employee_id": t.employee_id,
            "nombre": t.nombre,
            "apellido": t.apellido,
            "puesto": t.puesto,
            "zona": t.zona,
            "sucursal": t.sucursal,
            "embeddings": employee_embs
        }

        try:
            # Validar que los embeddings no tengan NaN o sean nulos
            if employee_embs and any(np.isnan(employee_embs)):
                logger.warning(f"⚠️ Embeddings de {t.nombre} contienen NaN, se enviarán vacíos.")
                employee_embs = []

            # Upsert por employee_id
            res = sb.table("empleados").upsert(data, on_conflict="employee_id").execute()
            logger.info(f"✅ Migrado: {t.nombre} {t.apellido}")
        except Exception as e:
            # Capturar respuesta detallada de Supabase si existe
            error_details = getattr(e, 'message', str(e))
            logger.error(f"❌ Error migrando a {t.nombre}: {error_details}")
            if hasattr(e, 'response'):
                logger.error(f"Response: {e.response.text}")

    db.close()
    logger.info("Migración completada.")

if __name__ == "__main__":
    migrate_employees()
