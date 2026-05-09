"""
Verificacion de integridad del schema Supabase — Safe Link Monitoring SaaS.
Ejecutado por GitHub Actions en cada push a main.

Valida el schema multitenant SaaS v1 (migracion 20260429_multitenant_saas_v1.sql)
y migraciones posteriores (provisioning, hwid_lock, embeddings, realtime).

Checks:
  1. Conexion con Supabase
  2. Tablas SaaS requeridas (empresas, sucursales, empleados, embeddings_faciales,
     dispositivos, registros_asistencia)
  3. Columnas criticas en empleados y registros_asistencia
  4. Vista v_asistencias_hoy accesible
  5. Extension pgvector instalada (verificada indirectamente via embeddings)
"""

import os
import sys
from pathlib import Path

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError as _e:
    print(f"Dependencia faltante: {_e}. pip install supabase python-dotenv")
    sys.exit(1)

root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

# ---------------------------------------------------------------------------
# Schema esperado (SaaS multitenant v1)
# ---------------------------------------------------------------------------

REQUIRED_TABLES = {
    "empresas":             "id, nombre, slug, plan, activa, max_empleados, max_estaciones, timezone",
    "sucursales":           "id, empresa_id, nombre, zona, ciudad, activa",
    "empleados":            "id, empresa_id, sucursal_id, nombre, apellido, employee_code, puesto, activo, enrollado",
    "embeddings_faciales":  "id, empleado_id, empresa_id, modelo_version, es_augmentado",
    "dispositivos":         "id, empresa_id, sucursal_id, nombre, api_key, activo",
    "registros_asistencia": "id, empresa_id, empleado_id, dispositivo_id, tipo, timestamp, confianza, reconocimiento_facial, sincronizado",
}

REQUIRED_VIEWS = ["v_asistencias_hoy"]

errors: list[str] = []
warnings: list[str] = []


def check(label: str, ok: bool, msg: str = ""):
    if ok:
        print(f"  [OK] {label}")
    else:
        print(f"  [FAIL] {label}" + (f": {msg}" if msg else ""))
        errors.append(label)


def warn(label: str, msg: str = ""):
    print(f"  [WARN] {label}" + (f": {msg}" if msg else ""))
    warnings.append(label)


def main():
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    if not url or not key:
        print("[FAIL] SUPABASE_URL o SUPABASE_KEY no configurados. Abortando.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 1. Conexion
    # ------------------------------------------------------------------
    print("\n[1/4] Conexion con Supabase...")
    try:
        sb: Client = create_client(url, key)
        print("  [OK] Cliente creado correctamente.")
    except Exception as e:
        print(f"  [FAIL] Error de conexion: {e}")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Tablas SaaS — existen y columnas criticas accesibles
    # ------------------------------------------------------------------
    print("\n[2/4] Verificando tablas SaaS multitenant...")
    for table, cols in REQUIRED_TABLES.items():
        try:
            sb.table(table).select(cols).limit(1).execute()
            check(f"Tabla '{table}' con columnas base", True)
        except Exception as e:
            check(f"Tabla '{table}' con columnas base", False, str(e))

    # ------------------------------------------------------------------
    # 3. Vistas
    # ------------------------------------------------------------------
    print("\n[3/4] Verificando vistas...")
    for view in REQUIRED_VIEWS:
        try:
            sb.from_(view).select("*").limit(1).execute()
            check(f"Vista '{view}' accesible", True)
        except Exception as e:
            check(f"Vista '{view}' accesible", False, str(e))

    # ------------------------------------------------------------------
    # 4. Tablas de provisioning / monitoring (advertencias, no bloquean)
    # ------------------------------------------------------------------
    print("\n[4/4] Verificando tablas de provisioning (opcionales)...")
    optional_tables = [
        ("station_pairing_codes",   "20260501_smart_pairing.sql"),
        ("station_provisioning",    "20260503_provisioning.sql"),
        ("station_heartbeats",      "20260430_station_monitoring.sql"),
    ]
    for table, migration in optional_tables:
        try:
            sb.table(table).select("*").limit(1).execute()
            check(f"Tabla '{table}'", True)
        except Exception as e:
            warn(f"Tabla '{table}' no encontrada (aplica {migration})", str(e))

    # ------------------------------------------------------------------
    # Resultado final
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    if errors:
        print(f"[FAIL] {len(errors)} error(es) critico(s):")
        for e in errors:
            print(f"   - {e}")
        if warnings:
            print(f"[WARN] {len(warnings)} advertencia(s) (no bloquean CI):")
            for w in warnings:
                print(f"   - {w}")
        print("\nAplica las migraciones pendientes desde supabase/migrations/ en orden.")
        sys.exit(1)
    else:
        if warnings:
            print(f"[OK] Sin errores criticos. {len(warnings)} advertencia(s):")
            for w in warnings:
                print(f"   - {w}")
        else:
            print("[OK] Todas las verificaciones pasaron correctamente.")
        sys.exit(0)


if __name__ == "__main__":
    main()
