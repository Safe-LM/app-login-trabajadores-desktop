"""
Verificación de integridad del schema Supabase — Safe Link Monitoring.
Ejecutado por GitHub Actions en cada push a main.

Checks:
  1. Conexión con Supabase
  2. Tablas requeridas existen y son accesibles
  3. Columnas críticas presentes en cada tabla
  4. Vistas v_asistencias_detalle y v_estado_empleados_hoy accesibles
  5. Sincronización de conteo empleados (solo si JSON local existe)
"""

import os
import sys
import json
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ supabase-py no instalado. pip install supabase")
    sys.exit(1)

root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "src"))

# Columnas que deben existir (verificadas con SELECT)
EMPLEADOS_COLS = "id, employee_id, nombre, apellido, puesto, zona, sucursal, activo"
ASISTENCIAS_COLS = (
    "id, empleado_id, tipo, timestamp, confianza, "
    "reconocimiento_facial, metodo, ubicacion, notas"
)

# Vistas requeridas
REQUIRED_VIEWS = [
    "v_asistencias_detalle",
    "v_estado_empleados_hoy",
]

errors: list[str] = []
warnings: list[str] = []


def check(label: str, ok: bool, msg: str = ""):
    if ok:
        print(f"  ✅ {label}")
    else:
        print(f"  ❌ {label}" + (f": {msg}" if msg else ""))
        errors.append(label)


def warn(label: str, msg: str = ""):
    print(f"  ⚠️  {label}" + (f": {msg}" if msg else ""))
    warnings.append(label)


def main():
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_KEY", "").strip()

    if not url or not key:
        print("❌ SUPABASE_URL o SUPABASE_KEY no configurados. Abortando.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 1. Conexión
    # ------------------------------------------------------------------
    print("\n[1/5] Conexión con Supabase...")
    try:
        sb: Client = create_client(url, key)
        print("  ✅ Cliente creado correctamente.")
    except Exception as e:
        print(f"  ❌ Error de conexión: {e}")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Tabla empleados — columnas críticas
    # ------------------------------------------------------------------
    print("\n[2/5] Verificando tabla 'empleados'...")
    try:
        sb.table("empleados").select(EMPLEADOS_COLS).limit(1).execute()
        check("Columnas base de empleados", True)
    except Exception as e:
        check("Columnas base de empleados", False, str(e))

    # Columnas v2 (opcionales aún si la migración no se aplicó)
    for col in ("activo", "turno", "hora_entrada_default", "updated_at"):
        try:
            sb.table("empleados").select(col).limit(1).execute()
            check(f"Columna empleados.{col} (v2)", True)
        except Exception as e:
            warn(f"Columna empleados.{col} no encontrada (aplica 20260320_schema_v2.sql)", str(e))

    # ------------------------------------------------------------------
    # 3. Tabla asistencias — columnas críticas
    # ------------------------------------------------------------------
    print("\n[3/5] Verificando tabla 'asistencias'...")
    try:
        sb.table("asistencias").select(ASISTENCIAS_COLS).limit(1).execute()
        check("Columnas base de asistencias", True)
    except Exception as e:
        check("Columnas base de asistencias", False, str(e))

    for col in ("reconocimiento_facial", "metodo", "notas", "dispositivo", "sincronizado_en"):
        try:
            sb.table("asistencias").select(col).limit(1).execute()
            check(f"Columna asistencias.{col} (v2)", True)
        except Exception as e:
            warn(f"Columna asistencias.{col} no encontrada (aplica 20260320_schema_v2.sql)", str(e))

    # ------------------------------------------------------------------
    # 4. Vistas
    # ------------------------------------------------------------------
    print("\n[4/5] Verificando vistas...")
    for view in REQUIRED_VIEWS:
        try:
            sb.from_(view).select("*").limit(1).execute()
            check(f"Vista '{view}' accesible", True)
        except Exception as e:
            warn(f"Vista '{view}' no disponible (aplica 20260320_schema_v2.sql)", str(e))

    # Vista legacy (debe existir siempre)
    try:
        sb.from_("v_asistencias_con_nombre").select("*").limit(1).execute()
        check("Vista 'v_asistencias_con_nombre' (legado)", True)
    except Exception as e:
        check("Vista 'v_asistencias_con_nombre' (legado)", False, str(e))

    # ------------------------------------------------------------------
    # 5. Sincronización de conteo (solo si JSON local existe)
    # ------------------------------------------------------------------
    print("\n[5/5] Verificando sincronización de empleados...")
    json_path = root_dir / "database_fotos" / "json" / "employees_db.json"
    if not json_path.exists():
        warn(
            "employees_db.json no encontrado en el runner",
            "Normal en CI — el archivo de fotos no se commitea al repo",
        )
    else:
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                local_employees = json.load(f)
            local_count = len(local_employees)

            res = sb.table("empleados").select("id", count="exact").execute()
            cloud_count = res.count or 0

            print(f"  📊 Empleados locales (JSON): {local_count}")
            print(f"  📊 Empleados en nube:        {cloud_count}")

            if local_count != cloud_count:
                diff = abs(local_count - cloud_count)
                # Diferencia pequeña (≤5) → warning, no error
                if diff <= 5:
                    warn(
                        f"Diferencia de {diff} empleados entre local y nube",
                        "Posible sincronización pendiente",
                    )
                else:
                    check(
                        f"Conteo empleados ({local_count} local vs {cloud_count} nube)",
                        False,
                        f"Diferencia de {diff}. Ejecuta 'python scripts/massive_cleanup.py'",
                    )
            else:
                check("Conteo empleados sincronizado", True)
        except Exception as e:
            warn("Error verificando conteo de empleados", str(e))

    # ------------------------------------------------------------------
    # Resultado final
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    if errors:
        print(f"❌ {len(errors)} error(es) crítico(s):")
        for e in errors:
            print(f"   • {e}")
        if warnings:
            print(f"⚠️  {len(warnings)} advertencia(s) (no bloquean CI):")
            for w in warnings:
                print(f"   • {w}")
        print("\n💡 Aplica la migración 20260320_schema_v2.sql en Supabase SQL Editor.")
        sys.exit(1)
    else:
        if warnings:
            print(f"✅ Sin errores críticos. {len(warnings)} advertencia(s):")
            for w in warnings:
                print(f"   • {w}")
            print("\n💡 Para eliminar advertencias aplica 20260320_schema_v2.sql.")
        else:
            print("✅ Todas las verificaciones pasaron correctamente.")
        sys.exit(0)


if __name__ == "__main__":
    main()
