#!/usr/bin/env python3
"""
Aplica todas las migraciones pendientes a Supabase en orden.

Necesitas UNA de estas opciones en tu .env:

  Opcion A — URL completa de BD:
    SUPABASE_DB_URL=postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres

  Opcion B — Solo la password (ya tienes SUPABASE_URL en .env):
    SUPABASE_DB_PASSWORD=tu_contrasena_de_bd

Obtener password: Supabase Dashboard > Settings > Database > Database password

Uso:
  python scripts/run_supabase_migration.py           # aplica todas
  python scripts/run_supabase_migration.py --dry-run # solo muestra los archivos, no ejecuta
"""
import os
import re
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir / "src"))
os.chdir(root_dir)

from dotenv import load_dotenv
load_dotenv(root_dir / ".env")

# Migraciones en orden cronológico (el nombre ya garantiza el orden)
MIGRATIONS_DIR = root_dir / "supabase" / "migrations"
MIGRATIONS = [
    "20260312_mejorar_asistencias.sql",
    "20260320_schema_v2.sql",
    "20260322_sucursales_horarios.sql",
]

DRY_RUN = "--dry-run" in sys.argv


def sep(char="─", n=60):
    print(char * n)


def get_db_url() -> str | None:
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        return sys.argv[1]
    db_url = os.getenv("SUPABASE_DB_URL")
    if db_url:
        return db_url
    url = os.getenv("SUPABASE_URL", "")
    pwd = os.getenv("SUPABASE_DB_PASSWORD", "")
    if url and pwd:
        m = re.search(r"https://([^.]+)\.supabase\.co", url)
        if m:
            ref = m.group(1)
            return (
                f"postgresql://postgres.{ref}:{pwd}"
                f"@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
            )
    return None


def main():
    sep("═")
    print("  Safe Link Monitoring — Aplicador de migraciones Supabase")
    sep("═")

    if DRY_RUN:
        print("  [DRY RUN] Solo mostrando archivos, sin ejecutar nada.\n")

    db_url = get_db_url()
    if not db_url and not DRY_RUN:
        sep()
        print("[X] No se encontró configuración de BD. Agrega a tu .env:\n")
        print("  Opción A — URL completa:")
        print("    SUPABASE_DB_URL=postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres\n")
        print("  Opción B — Solo password (tienes SUPABASE_URL):")
        print("    SUPABASE_DB_PASSWORD=tu_contrasena_de_bd\n")
        print("  Obtener password: Supabase Dashboard > Settings > Database > Database password")
        sep()
        sys.exit(1)

    if not DRY_RUN:
        try:
            import psycopg2
        except ImportError:
            print("[X] Instala psycopg2: pip install psycopg2-binary")
            sys.exit(1)

        try:
            conn = psycopg2.connect(db_url)
            conn.autocommit = False
            print("[OK] Conexión con Supabase establecida.\n")
        except Exception as e:
            print(f"[X] Error de conexión: {e}")
            print("\n  Verifica que SUPABASE_DB_PASSWORD sea la password de la BD")
            print("  (no la API key). Ve a: Supabase > Settings > Database > Reset password")
            sys.exit(1)

    errores = 0
    for filename in MIGRATIONS:
        path = MIGRATIONS_DIR / filename
        sep()
        print(f"  Migración: {filename}")

        if not path.exists():
            print(f"  [SKIP] Archivo no encontrado: {path}")
            continue

        sql = path.read_text(encoding="utf-8")
        lineas = len(sql.splitlines())
        print(f"  Tamaño:   {lineas} líneas")

        if DRY_RUN:
            print("  [DRY RUN] No ejecutado.")
            continue

        try:
            cur = conn.cursor()
            cur.execute(sql)
            conn.commit()
            cur.close()
            print("  [OK] Aplicada correctamente.")
        except Exception as e:
            conn.rollback()
            print(f"  [X] Error: {e}")
            errores += 1

    if not DRY_RUN:
        conn.close()

    sep("═")
    if DRY_RUN:
        print("  DRY RUN completado. Quita --dry-run para ejecutar.")
    elif errores == 0:
        print("  Todas las migraciones aplicadas correctamente.")
        print()
        print("  Vistas disponibles en Supabase:")
        print("    SELECT * FROM v_asistencias_detalle    LIMIT 20;")
        print("    SELECT * FROM v_estado_empleados_hoy;")
        print("    SELECT * FROM v_resumen_diario;")
    else:
        print(f"  {errores} migración(es) con error. Revisa los mensajes arriba.")
        sys.exit(1)
    sep("═")


if __name__ == "__main__":
    main()
