"""
Inserta una notificación en la tabla `notificaciones` de Supabase para
cada empresa que tenga al menos una estación registrada.

Llamado desde .github/workflows/notify-release.yml después de que se
publica un release station-v*.

Variables de entorno requeridas:
    SUPABASE_URL                — URL del proyecto
    SUPABASE_SERVICE_ROLE_KEY   — service role key (bypass RLS)
    VERSION                     — ej. "5.2.0"
    TAG                         — ej. "station-v5.2.0"
    REPO                        — ej. "Safe-LM/app-login-trabajadores-desktop"

Dedupe: usa la RPC `crear_notificacion` que respeta dedupe_key dentro
de los últimos 30 min, así si republicas el mismo tag no duplicas.
"""

from __future__ import annotations

import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase-py no instalado", file=sys.stderr)
    sys.exit(1)


def main() -> int:
    url      = os.environ["SUPABASE_URL"]
    key      = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    version  = os.environ["VERSION"]
    tag      = os.environ["TAG"]
    repo     = os.environ["REPO"]

    sb = create_client(url, key)
    print(f"Notificando release {version} (tag: {tag}) a empresas con estaciones...")

    # Solo notificar a empresas que tienen al menos un dispositivo activo,
    # para no spamear a empresas que solo usan el panel sin estaciones fisicas.
    resp = sb.table("dispositivos").select("empresa_id").eq("activo", True).execute()
    empresa_ids = sorted({d["empresa_id"] for d in (resp.data or []) if d.get("empresa_id")})

    if not empresa_ids:
        print("No hay empresas con estaciones activas — nada que notificar.")
        return 0

    print(f"Empresas a notificar: {len(empresa_ids)}")

    titulo  = f"Nueva versión disponible · v{version}"
    mensaje = (
        f"Safe Link Station v{version} ya está publicada. "
        f"Tus estaciones la detectarán en el próximo arranque (15s) y "
        f"actualizarán automáticamente. Para ver los cambios o forzar "
        f"actualización, visita la sección de Estaciones."
    )
    metadata = {
        "version": version,
        "tag": tag,
        "release_url": f"https://github.com/{repo}/releases/tag/{tag}",
        "download_url": (
            f"https://github.com/{repo}/releases/download/{tag}/"
            f"SafeLinkStation_Setup_{version}.exe"
        ),
    }

    ok_count = 0
    fail_count = 0
    for empresa_id in empresa_ids:
        try:
            sb.rpc("crear_notificacion", {
                "p_empresa_id": empresa_id,
                "p_tipo":       "system_release_available",
                "p_severidad":  "info",
                "p_titulo":     titulo,
                "p_mensaje":    mensaje,
                "p_metadata":   metadata,
                # Dedupe: misma version a la misma empresa solo una vez
                "p_dedupe_key": f"release:{version}:{empresa_id}",
                "p_dedupe_window_min": 24 * 60,  # 24h
            }).execute()
            ok_count += 1
        except Exception as e:
            print(f"  [WARN] empresa {empresa_id}: {e}")
            fail_count += 1

    print(f"\nResultado: {ok_count} OK, {fail_count} fallidas")
    if fail_count > 0 and ok_count == 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
