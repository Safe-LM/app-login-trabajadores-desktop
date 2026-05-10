"""
Helper que solo extrae la seccion de una version del CHANGELOG.md
y la imprime a stdout. Reutiliza la logica de generate_release_body.py.

Uso:
    python extract_changelog.py <changelog_path> <version>
    python extract_changelog.py web-panel/CHANGELOG.md 0.1.2
"""

import sys
from pathlib import Path

# Reutilizar la funcion del otro script
sys.path.insert(0, str(Path(__file__).parent))
from generate_release_body import _extract_changelog_section  # type: ignore


def main() -> int:
    if len(sys.argv) != 3:
        print("Uso: extract_changelog.py <changelog_path> <version>", file=sys.stderr)
        return 1
    changelog_path = sys.argv[1]
    version = sys.argv[2]
    section = _extract_changelog_section(changelog_path, version)
    print(section)
    return 0


if __name__ == "__main__":
    sys.exit(main())
