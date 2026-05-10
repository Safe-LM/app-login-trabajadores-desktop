"""
Build info — generado en CI durante el empaquetado.

Este archivo es REEMPLAZADO automaticamente por GitHub Actions con los
valores reales del build (commit hash, fecha, version) antes de correr
PyInstaller. El default aqui es solo para desarrollo local.

NO commitear cambios a este archivo a menos que sea para ajustar el
formato — los valores reales no deben quedar versionados.
"""

# Sobrescritos en CI por inject_build_info.py
VERSION    = "5.1.0-dev"
COMMIT_SHA = "0000000"
BUILD_DATE = "2026-05-09"
BUILD_RUN  = "local"


def get_full_version() -> str:
    """Devuelve algo como '5.2.0 (build 2026-05-09 abc1234)'."""
    return f"{VERSION} (build {BUILD_DATE} {COMMIT_SHA})"


def get_dict() -> dict:
    """Para enviar al panel en heartbeat / logs."""
    return {
        "version":    VERSION,
        "commit_sha": COMMIT_SHA,
        "build_date": BUILD_DATE,
        "build_run":  BUILD_RUN,
    }


def get_short_version() -> str:
    """Version compacta para mostrar en UI: '5.2.0 · abc1234'."""
    return f"{VERSION} · {COMMIT_SHA}"
