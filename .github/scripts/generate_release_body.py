"""
Genera el cuerpo del GitHub Release combinando:
- Banners contextuales (BREAKING, hotfix, installer changes)
- Descripcion del producto
- Tabla de descarga con tamano y SHA256
- Pasos de instalacion
- Cambios categorizados (extraidos del CHANGELOG.md generado por release-please)
- Estadisticas del release (commits, contribuidores, issues)
- Dropdown con info tecnica del build

Uso desde CI:
    python generate_release_body.py \
        --version 5.2.0 \
        --tag station-v5.2.0 \
        --previous-tag station-v5.1.0 \
        --installer-path station/installer/SafeLinkStation_Setup_5.2.0.exe \
        --sha256-file station/installer/SHA256SUMS.txt \
        --commit-sha abc1234567890 \
        --build-run-id 142 \
        --repo Safe-LM/app-login-trabajadores-desktop \
        --output release_body.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import subprocess
import sys
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--version",         required=True)
    p.add_argument("--tag",             required=True)
    p.add_argument("--previous-tag",    default="")
    p.add_argument("--installer-path",  required=True)
    p.add_argument("--sha256-file",     required=True)
    p.add_argument("--commit-sha",      required=True)
    p.add_argument("--build-run-id",    required=True)
    p.add_argument("--repo",            required=True, help="owner/repo")
    p.add_argument("--changelog-path",  default="CHANGELOG.md")
    p.add_argument("--output",          required=True)
    args = p.parse_args()

    repo_url = f"https://github.com/{args.repo}"
    short_sha = args.commit_sha[:7]
    build_date = dt.date.today().isoformat()

    # Tamaño del .exe
    installer = Path(args.installer_path)
    size_mb = round(installer.stat().st_size / 1024 / 1024, 1) if installer.exists() else 0.0

    # SHA256
    sha256 = "(no disponible)"
    sha_file = Path(args.sha256_file)
    if sha_file.exists():
        first_line = sha_file.read_text(encoding="utf-8").strip().splitlines()[0]
        sha256 = first_line.split()[0] if first_line else "(no disponible)"

    # Commits desde el tag anterior
    commits = _get_commits(args.previous_tag, args.commit_sha)
    breaking = _detect_breaking(commits)
    has_installer_changes = any(c["scope"] == "installer" for c in commits)
    has_station_changes  = any(c["scope"] == "station"   for c in commits)
    has_panel_changes    = any(c["scope"] == "web-panel" for c in commits)
    contributors = _get_contributors(args.previous_tag, args.commit_sha)

    # Sección "Cambios" extraída del CHANGELOG (generado por release-please)
    changes_section = _extract_changelog_section(args.changelog_path, args.version)

    body = _build_body(
        version=args.version,
        tag=args.tag,
        previous_tag=args.previous_tag,
        repo_url=repo_url,
        commit_sha=args.commit_sha,
        short_sha=short_sha,
        build_date=build_date,
        build_run_id=args.build_run_id,
        installer_filename=installer.name,
        size_mb=size_mb,
        sha256=sha256,
        breaking=breaking,
        has_installer_changes=has_installer_changes,
        has_station_changes=has_station_changes,
        has_panel_changes=has_panel_changes,
        commits_count=len(commits),
        contributors=contributors,
        changes_section=changes_section,
    )

    Path(args.output).write_text(body, encoding="utf-8")
    print(f"Release body escrito en {args.output} ({len(body)} bytes)")
    return 0


def _get_commits(previous_tag: str, commit_sha: str) -> list[dict]:
    if not previous_tag:
        return []
    try:
        out = subprocess.run(
            ["git", "log", f"{previous_tag}..{commit_sha}", "--pretty=format:%H||%s||%an"],
            capture_output=True, text=True, check=True, encoding="utf-8",
        )
    except Exception:
        return []

    commits = []
    pattern = re.compile(r"^(?P<type>\w+)(?:\((?P<scope>[^)]+)\))?(?P<bang>!?):\s*(?P<subject>.+)$")
    for line in out.stdout.splitlines():
        parts = line.split("||")
        if len(parts) != 3:
            continue
        sha, subject, author = parts
        m = pattern.match(subject)
        if m:
            commits.append({
                "sha": sha,
                "type": m.group("type"),
                "scope": m.group("scope") or "",
                "bang": bool(m.group("bang")),
                "subject": m.group("subject"),
                "author": author,
            })
        else:
            commits.append({
                "sha": sha, "type": "", "scope": "", "bang": False,
                "subject": subject, "author": author,
            })
    return commits


def _detect_breaking(commits: list[dict]) -> bool:
    """Detecta si hay BREAKING CHANGES (commits con !)."""
    return any(c.get("bang") for c in commits)


def _get_contributors(previous_tag: str, commit_sha: str) -> list[str]:
    if not previous_tag:
        return []
    try:
        out = subprocess.run(
            ["git", "log", f"{previous_tag}..{commit_sha}", "--pretty=format:%an"],
            capture_output=True, text=True, check=True, encoding="utf-8",
        )
    except Exception:
        return []
    seen = set()
    result = []
    for name in out.stdout.splitlines():
        name = name.strip()
        if name and name not in seen and "github-actions" not in name.lower():
            seen.add(name)
            result.append(name)
    return result


def _extract_changelog_section(changelog_path: str, version: str) -> str:
    """Extrae la seccion del CHANGELOG correspondiente a esta version."""
    p = Path(changelog_path)
    if not p.exists():
        return "_(Cambios detallados en el CHANGELOG.md)_"

    content = p.read_text(encoding="utf-8")
    # Buscar encabezado "## [X.Y.Z]" y capturar hasta el siguiente "##"
    pattern = re.compile(
        rf"^##\s*\[?{re.escape(version)}\]?[^\n]*\n+(.+?)(?=^##\s*\[?\d+\.|^---\s*$)",
        re.MULTILINE | re.DOTALL,
    )
    m = pattern.search(content)
    if not m:
        return "_(Ver [`CHANGELOG.md`](./CHANGELOG.md) para el detalle completo)_"
    return m.group(1).strip()


def _build_body(**kw) -> str:
    repo_url = kw["repo_url"]
    tag = kw["tag"]
    previous_tag = kw["previous_tag"]
    version = kw["version"]
    short_sha = kw["short_sha"]

    banners = []
    if kw["breaking"]:
        banners.append(
            "> ⚠️ **BREAKING CHANGES**\n>\n"
            "> Esta versión incluye cambios incompatibles con versiones anteriores.\n"
            "> Lee la sección de cambios y los release notes con cuidado antes de actualizar."
        )
    if kw["has_installer_changes"]:
        banners.append(
            "> 📦 **CAMBIOS EN EL INSTALADOR**\n>\n"
            "> El instalador de esta versión tiene mejoras. Si vienes de una versión "
            "muy anterior, considera desinstalar primero antes de actualizar."
        )

    banners_md = "\n\n".join(banners) + "\n\n" if banners else ""

    contributors_md = ""
    if kw["contributors"]:
        contribs = ", ".join(f"@{c}" if not c.startswith("@") else c for c in kw["contributors"])
        contributors_md = f"**Contribuidores en esta versión:** {contribs}\n\n"

    compare_link = (
        f"[`{previous_tag}...{tag}`]({repo_url}/compare/{previous_tag}...{tag})"
        if previous_tag else "_(primer release)_"
    )

    station_section = ""
    if kw["has_station_changes"] or kw["has_installer_changes"]:
        station_section = f"""
## 🛠️ Para usuarios de la estación

Tu estación se actualizará automáticamente al detectar esta versión (en los próximos 15 segundos del próximo arranque).

**Si quieres actualizar AHORA:**
1. **Desde el panel web** → Estaciones → ⋮ menú → "Actualizar ahora"
2. **Manualmente**: descarga el `.exe`, ciérrale a la estación, ejecuta el instalador (mantiene tu configuración)

**Para desactivar auto-update**, agrega a tu `.env`:
```ini
AUTO_UPDATE_ENABLED=false
```
"""

    panel_section = ""
    if kw["has_panel_changes"]:
        panel_section = """
## 🌐 Para usuarios del panel web

Los cambios del panel se aplican automáticamente al recargar la página. No requiere acción.
"""

    return f"""> **Safe Link Station** — versión `{version}` publicada el `{kw["build_date"]}`
> Build SHA: `{short_sha}` · CI run [#{kw["build_run_id"]}]({repo_url}/actions/runs/{kw["build_run_id"]})

{banners_md}## 📥 Descargar

| Plataforma | Archivo | Tamaño | SHA256 |
|---|---|---|---|
| 🪟 Windows 10/11 (x64) | [`{kw["installer_filename"]}`]({repo_url}/releases/download/{tag}/{kw["installer_filename"]}) | {kw["size_mb"]} MB | `{kw["sha256"]}` |

## 🚀 Instalación rápida

1. Descarga `{kw["installer_filename"]}`
2. Doble click → "Más información" → "Ejecutar de todas formas"
3. Sigue el wizard de instalación (3 minutos)
4. Pega tu API Key del [panel web](https://panel.safelink.app)

📖 **Manual completo:** [docs/MANUAL_INSTALACION.md]({repo_url}/blob/main/docs/MANUAL_INSTALACION.md)

## 📝 Cambios en esta versión

{kw["changes_section"]}
{station_section}{panel_section}
## 🔍 Verificar integridad de la descarga

```powershell
certutil -hashfile {kw["installer_filename"]} SHA256
```

Compara con: `{kw["sha256"]}`

## 📊 Estadísticas del release

- **{kw["commits_count"]} commits** desde {previous_tag or "el inicio"}
- **{len(kw["contributors"])} contribuidor{"es" if len(kw["contributors"]) != 1 else ""}** únicos
- **Comparación**: {compare_link}

{contributors_md}---

<details>
<summary>🛠️ Información técnica del build</summary>

- **Commit completo**: [`{kw["commit_sha"]}`]({repo_url}/commit/{kw["commit_sha"]})
- **Build date**: `{kw["build_date"]}`
- **Workflow run**: [#{kw["build_run_id"]}]({repo_url}/actions/runs/{kw["build_run_id"]})
- **Tag**: `{tag}`
- **PyInstaller spec**: [`station/SafeLink_Station.spec`]({repo_url}/blob/main/station/SafeLink_Station.spec)
- **NSIS installer**: [`station/installer/installer.nsi`]({repo_url}/blob/main/station/installer/installer.nsi)

</details>

---

⚠️ **Sin firma digital**: el `.exe` no está firmado con un certificado de Authenticode (cuando crezcamos a +50 clientes lo agregamos). Windows mostrará "Editor desconocido" — es normal: click en "Más información" → "Ejecutar de todas formas".

🐛 ¿Encontraste un bug? [Reporta en Issues]({repo_url}/issues/new/choose) con la versión `{version}` y los logs de `C:\\Program Files\\Safe Link Station\\logs\\`.
"""


if __name__ == "__main__":
    sys.exit(main())
