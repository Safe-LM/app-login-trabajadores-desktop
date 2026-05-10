"""
Inserta una notificación en la tabla `notificaciones` de Supabase para
cada empresa que tenga al menos una estación activa.

Llamado desde .github/workflows/notify-release.yml después de que se
publica un release (station-v* o web-panel-v*).

Variables de entorno requeridas:
    SUPABASE_URL                — URL del proyecto
    SUPABASE_SERVICE_ROLE_KEY   — service role key (bypass RLS)
    COMPONENT                   — "station" o "web-panel"
    VERSION                     — ej. "5.2.0"
    TAG                         — ej. "station-v5.2.0"
    REPO                        — ej. "Safe-LM/app-login-trabajadores-desktop"

Dedupe: usa la RPC `crear_notificacion` que respeta dedupe_key,
así si republicas el mismo tag no duplicas notificaciones.
"""

from __future__ import annotations

import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("ERROR: supabase-py no instalado", file=sys.stderr)
    sys.exit(1)


def _build_payload(component: str, version: str, tag: str, repo: str) -> dict:
    """Devuelve el payload {tipo, titulo, mensaje, metadata} segun el componente."""
    base_metadata = {
        "component":   component,
        "version":     version,
        "tag":         tag,
        "release_url": f"https://github.com/{repo}/releases/tag/{tag}",
    }

    if component == "station":
        return {
            "tipo":      "system_release_available",
            "severidad": "info",
            "titulo":    f"Nueva versión de la estación · v{version}",
            "mensaje": (
                f"Safe Link Station v{version} ya está publicada. "
                f"Tus estaciones la detectarán en el próximo arranque (15s) "
                f"y se actualizarán automáticamente. Para ver los cambios "
                f"visita la sección de Estaciones."
            ),
            "metadata": {
                **base_metadata,
                "download_url": (
                    f"https://github.com/{repo}/releases/download/{tag}/"
                    f"SafeLinkStation_Setup_{version}.exe"
                ),
            },
        }

    if component == "web-panel":
        return {
            "tipo":      "panel_release_available",
            "severidad": "info",
            "titulo":    f"Panel actualizado · v{version}",
            "mensaje": (
                f"El panel web se actualizó con mejoras y correcciones. "
                f"Recarga la página (Ctrl+R) para ver los cambios. "
                f"Si tu navegador tiene cache agresivo, prueba Ctrl+Shift+R."
            ),
            "metadata": base_metadata,
        }

    # Fallback genérico
    return {
        "tipo":      "system_release_available",
        "severidad": "info",
        "titulo":    f"Nueva versión disponible · v{version}",
        "mensaje":   f"Componente {component} actualizado a v{version}.",
        "metadata":  base_metadata,
    }


def main() -> int:
    url       = os.environ["SUPABASE_URL"]
    key       = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    component = os.environ.get("COMPONENT", "station")
    version   = os.environ["VERSION"]
    tag       = os.environ["TAG"]
    repo      = os.environ["REPO"]

    sb = create_client(url, key)
    print(f"Notificando release de {component} v{version} (tag: {tag})...")

    # Solo notificar a empresas con estaciones activas (filtro común
    # para station y web-panel: si una empresa no tiene estaciones,
    # tampoco usa el panel todavía).
    resp = sb.table("dispositivos").select("empresa_id").eq("activo", True).execute()
    empresa_ids = sorted({d["empresa_id"] for d in (resp.data or []) if d.get("empresa_id")})

    if not empresa_ids:
        print("No hay empresas con estaciones activas — nada que notificar.")
        return 0

    print(f"Empresas a notificar: {len(empresa_ids)}")

    payload = _build_payload(component, version, tag, repo)

    ok_count = 0
    fail_count = 0
    for empresa_id in empresa_ids:
        try:
            sb.rpc("crear_notificacion", {
                "p_empresa_id": empresa_id,
                "p_tipo":       payload["tipo"],
                "p_severidad":  payload["severidad"],
                "p_titulo":     payload["titulo"],
                "p_mensaje":    payload["mensaje"],
                "p_metadata":   payload["metadata"],
                "p_dedupe_key": f"release:{component}:{version}:{empresa_id}",
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
