import os
import sys
from pathlib import Path
import json
import logging
import pickle
import numpy as np
import bcrypt

# Setup path
root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "src"))

from utils.database import get_db_session
from utils.models import Trabajador, RegistroAsistencia
from utils.supabase_client import get_supabase_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MassiveCleanup")


def cleanup_and_reseed():
    """Limpia las bases de datos local y cloud, y resincroniza los 56 empleados reales."""

    # --- 1. CARGAR DATOS DE REFERENCIA (JSON de 56 empleados) ---
    json_path = root_dir / "database_fotos" / "json" / "employees_db.json"
    if not json_path.exists():
        logger.error(f"❌ No se encontró {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        employees_manifest = json.load(f)

    logger.info(f"📋 Cargados {len(employees_manifest)} empleados del manifiesto JSON.")

    # --- 2. CARGAR EMBEDDINGS (Pickle) ---
    encodings_path = root_dir / "database_fotos" / "face_encodings_opencv.pkl"
    encs_data = {}
    if encodings_path.exists():
        with open(encodings_path, "rb") as f:
            encs_data = pickle.load(f)  # nosec
            logger.info("🧠 Embeddings faciales cargados.")

    # --- 3. LIMPIAR SQLITE (LOCAL) ---
    db = get_db_session()
    try:
        # Borrar todas las asistencias primero por FK
        db.query(RegistroAsistencia).delete()
        # Borrar todos los trabajadores excepto el admin
        db.query(Trabajador).filter(Trabajador.usuario != "admin").delete()
        db.commit()
        logger.info("🗑️ SQLite local limpia (excepto admin).")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error limpiando SQLite: {e}")
        return
    finally:
        db.close()

    # --- 4. LIMPIAR SUPABASE (CLOUD) ---
    sb = get_supabase_client()
    if sb:
        try:
            # En Supabase las asistencias borran en cascada (o hay que borrarlas primero)
            sb.table("asistencias").delete().neq(
                "id", "00000000-0000-0000-0000-000000000000"
            ).execute()
            sb.table("empleados").delete().neq(
                "id", "00000000-0000-0000-0000-000000000000"
            ).execute()
            logger.info("🗑️ Supabase cloud limpia.")
        except Exception as e:
            logger.error(f"❌ Error limpiando Supabase: {e}")
            # Continuamos de todos modos con SQLite
    else:
        logger.warning("⚠️ No se pudo conectar a Supabase, saltando limpieza cloud.")

    # --- 5. RESEMBRAR (INSERTAR LOS 56) ---
    db = get_db_session()
    for e in employees_manifest:
        eid = e["employee_id"]
        nombre_completo = e["nombre"]
        parts = nombre_completo.split()
        if len(parts) >= 3:
            # Caso típico: APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S)
            apellido = f"{parts[0]} {parts[1]}"
            nombre = " ".join(parts[2:])
        elif len(parts) == 2:
            # Caso: APELLIDO NOMBRE
            apellido = parts[0]
            nombre = parts[1]
        else:
            nombre = nombre_completo
            apellido = ""

        # Insertar en SQLite (Local)
        usuario = f"empleado_{eid}"
        new_worker = Trabajador(
            usuario=usuario,
            password_hash=bcrypt.hashpw(
                "password123".encode(), bcrypt.gensalt()
            ).decode(),
            nombre=nombre,
            apellido=apellido,
            zona=e.get("zona", "N/A"),
            sucursal=e.get("sucursal", "N/A"),
            puesto=e.get("puesto", "N/A"),
            employee_id=eid,
            foto_path=e.get("photo_file", ""),
            activo=True,
        )
        db.add(new_worker)

        # Preparar para Supabase
        if sb:
            # Calcular embedding si existe en el pickle
            employee_embs = []
            if encs_data:
                indices = [
                    i
                    for i, idx_id in enumerate(encs_data.get("employee_ids", []))
                    if idx_id == eid
                ]
                if indices:
                    relevant_encs = [encs_data["encodings"][i] for i in indices]
                    avg_emb = np.mean(
                        relevant_encs, axis=0
                    )  # Promedio de los embeddings
                    # Limpiar NaNs si hubiera por error en entrenamiento
                    if not any(np.isnan(avg_emb)):
                        employee_embs = avg_emb.tolist()

            sb_data = {
                "employee_id": eid,
                "nombre": nombre,
                "apellido": apellido,
                "puesto": e.get("puesto", "N/A"),
                "zona": e.get("zona", "N/A"),
                "sucursal": e.get("sucursal", "N/A"),
                "embeddings": employee_embs,
            }
            try:
                sb.table("empleados").insert(sb_data).execute()
            except Exception as ex:
                logger.error(f"❌ Error insertando {nombre} en Supabase: {ex}")

    try:
        db.commit()
        logger.info(
            f"✅ Se han reinsertado {len(employees_manifest)} empleados exitosamente."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error al guardar datos en SQLite: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    cleanup_and_reseed()
