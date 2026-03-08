import os
import sys
import json
from pathlib import Path
from supabase import create_client, Client

# Añadir src al path
root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "src"))


def check_supabase_sync():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        print("❌ Error: SUPABASE_URL o SUPABASE_KEY no configurados en el entorno.")
        sys.exit(1)

    try:
        sb: Client = create_client(url, key)
        print("✅ Conexión establecida con Supabase.")
    except Exception as e:
        print(f"❌ Error de conexión: {e}")
        sys.exit(1)

    # 1. Verificar conteo de empleados
    json_path = root_dir / "database_fotos" / "json" / "employees_db.json"
    if not json_path.exists():
        print(
            f"⚠️ Manifiesto JSON no encontrado en {json_path}. Saltando validación de conteo."
        )
        return

    with open(json_path, "r", encoding="utf-8") as f:
        local_employees = json.load(f)
    local_count = len(local_employees)

    try:
        res = sb.table("empleados").select("id", count="exact").execute()
        cloud_count = res.count
        print(f"📊 Empleados locales: {local_count}")
        print(f"📊 Empleados en nube: {cloud_count}")

        if local_count != cloud_count:
            print(
                f"❌ ERROR: Desincronización detectada ({local_count} vs {cloud_count})."
            )
            print(
                "💡 Ejecuta 'python scripts/massive_cleanup.py' localmente para sincronizar."
            )
            sys.exit(1)
        else:
            print("✅ Sincronización de empleados correcta.")
    except Exception as e:
        print(f"❌ Error consultando tabla 'empleados': {e}")
        sys.exit(1)

    # 2. Verificar columnas críticas
    try:
        # Intentar una consulta pequeña para ver si las columnas existen
        test = (
            sb.table("empleados")
            .select("id, employee_id, embeddings")
            .limit(1)
            .execute()
        )
        print("✅ Esquema de tabla 'empleados' verificado.")
    except Exception as e:
        print(f"❌ Error de esquema: {e}")
        sys.exit(1)


if __name__ == "__main__":
    check_supabase_sync()
