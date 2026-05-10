"""
Inyecta los valores reales de build (version, commit, fecha) en
station/src/build_info.py antes de que PyInstaller lo empaquete.

Uso desde CI:
    python inject_build_info.py --version 5.2.0 --sha abc1234 --run 42

Sin args: usa valores de git local + fecha actual (util en dev).
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path


def git(cmd: list[str]) -> str:
    try:
        out = subprocess.run(["git", *cmd], capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except Exception:
        return "0000000"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default=None, help="X.Y.Z o X.Y.Z-{sha}")
    parser.add_argument("--sha", default=None, help="commit short SHA (7 chars)")
    parser.add_argument("--run", default="local", help="GitHub Actions run number")
    args = parser.parse_args()

    version = args.version or _read_version_txt()
    sha = args.sha or git(["rev-parse", "--short=7", "HEAD"])
    build_date = dt.date.today().isoformat()
    build_run = args.run

    target = Path(__file__).parent / "src" / "build_info.py"
    if not target.exists():
        print(f"ERROR: no existe {target}", file=sys.stderr)
        return 1

    text = target.read_text(encoding="utf-8")

    replacements = {
        "VERSION":    version,
        "COMMIT_SHA": sha,
        "BUILD_DATE": build_date,
        "BUILD_RUN":  build_run,
    }
    # Reemplaza solo el valor entre comillas, preservando el espaciado
    # exacto de la izquierda (VAR<espacios>= "VALOR")
    for var, val in replacements.items():
        text = re.sub(
            rf'(^{var}\s*=\s*)"[^"]*"',
            lambda m: f'{m.group(1)}"{val}"',
            text,
            count=1,
            flags=re.MULTILINE,
        )

    target.write_text(text, encoding="utf-8")
    print(f"Build info inyectado en {target}:")
    for k, v in replacements.items():
        print(f"  {k} = {v}")
    return 0


def _read_version_txt() -> str:
    """Lee station/version.txt si existe, sino default."""
    vt = Path(__file__).parent / "version.txt"
    if vt.exists():
        return vt.read_text(encoding="utf-8").strip()
    return "5.1.0-dev"


if __name__ == "__main__":
    sys.exit(main())
