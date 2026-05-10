# 🚀 Sistema de Releases — Guía completa

> Cómo se publican nuevas versiones de Safe Link Station y Web Panel.
> Para usuarios finales, mira [`MANUAL_INSTALACION.md`](./MANUAL_INSTALACION.md).

---

## 📐 Arquitectura del flujo

```
┌──────────────────┐
│  Tú escribes     │   Conventional Commits
│  commits         │   feat(station): nueva pantalla...
└────────┬─────────┘
         │ git push origin main
         ▼
┌──────────────────────────────────────────────────────────┐
│  release-please                                          │   .github/workflows/release-build.yml
│  - Lee commits desde último release                      │
│  - Calcula bump (feat→minor, fix→patch, BREAKING→major)  │
│  - Abre/actualiza PR "chore(release): X.Y.Z"             │
│  - PR contiene CHANGELOG.md regenerado                   │
└────────┬─────────────────────────────────────────────────┘
         │ Mergeas el PR
         ▼
┌──────────────────────────────────────────────────────────┐
│  Tag automático: station-vX.Y.Z                          │   release-please
│  GitHub Release creado con notas categorizadas           │
└────────┬─────────────────────────────────────────────────┘
         │ trigger por tag
         ▼
┌──────────────────────────────────────────────────────────┐
│  station-installer.yml                                   │   .github/workflows/station-installer.yml
│  1. Build frontend Vite                                  │
│  2. PyInstaller bundle                                   │
│  3. NSIS installer                                       │
│  4. SHA256SUMS                                           │
│  5. Adjunta .exe al GitHub Release existente             │
└────────┬─────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Release público │   Listo para clientes
│  con .exe        │   + auto-update detectable
└──────────────────┘
```

---

## ✍️ Cómo escribir commits

Sigue [Conventional Commits](https://www.conventionalcommits.org/es/):

```
<tipo>(<scope>): <descripción minúscula>

[cuerpo opcional]

[BREAKING CHANGE: ... opcional]
```

| Tipo | Bump | Visible en CHANGELOG |
|---|---|---|
| `feat` | minor | ✨ Nuevas funcionalidades |
| `fix` | patch | 🐛 Correcciones |
| `perf` | patch | ⚡ Performance |
| `refactor` | patch | ♻️ Refactors |
| `docs` `style` `chore` `test` `build` `ci` | — | (oculto) |

**Detalles completos**: [`.github/COMMIT_CONVENTION.md`](../.github/COMMIT_CONVENTION.md)

---

## 🎯 Cómo publicar un release (paso a paso)

### Caso 1: release normal (95% de las veces)

```bash
# 1. Asegúrate de estar en main al día
git checkout main && git pull

# 2. (Opcional) Mira qué commits hay desde el último release
git log $(git describe --tags --abbrev=0 --match='station-v*')..HEAD --oneline

# 3. Espera a que release-please abra el PR (5-10 min tras el último push)
# 4. Revísalo en https://github.com/Safe-LM/.../pulls
# 5. Aprueba y mergea

# Eso es todo. El instalador aparecerá en /releases en ~10 min.
```

### Caso 2: release manual urgente (hotfix)

Si necesitas publicar **antes de que release-please reaccione**:

```bash
# 1. Calcula la siguiente versión (ej: estás en 5.1.0, fix → 5.1.1)
git tag station-v5.1.1
git push origin station-v5.1.1

# Esto dispara station-installer.yml directamente.
# release-please detectará el tag y NO duplicará el release.
```

### Caso 3: pre-release / beta

> **Pendiente** — agregar workflow para rama `beta`. Ver issue #pending.

---

## 📦 Anatomía de un release

Cada release tiene estos assets:

| Archivo | Para qué |
|---|---|
| `SafeLinkStation_Setup_X.Y.Z.exe` | Instalador final para clientes |
| `version.txt` | Solo el número de versión (`5.1.0`) — lo lee `auto_updater.py` |
| `SHA256SUMS.txt` | Hash del `.exe` para verificar integridad |

Y las **notas del release** incluyen:

- Tabla de descarga (plataforma + tamaño + hash)
- Pasos de instalación rápida
- Comando para verificar SHA256
- Sección de cambios auto-generada por categorías
- Dropdown con info técnica (commit, build date, workflow run)
- Aviso de "sin firma digital"

---

## 🔄 Auto-update en estaciones existentes

Cuando publicas v5.2.0, las estaciones con v5.1.x:

1. Al arrancar (después de 15s), consultan
   `https://github.com/Safe-LM/.../releases/latest/download/version.txt`
2. Comparan con su `version.txt` local
3. Si hay versión nueva:
   - Crean notificación en el panel (`station_update_available`)
   - El admin la ve en `/notificaciones` con severidad `info`
   - Cliente puede descargar manualmente desde el panel o aceptar la notif
4. Al instalar el nuevo `.exe`:
   - Verifica SHA256 contra `SHA256SUMS.txt` del release
   - Si NO coincide → aborta (seguridad)
   - Si coincide → corre el wizard NSIS (modo normal o silent)

Para **desactivar auto-update** en una estación:
```ini
# .env
AUTO_UPDATE_ENABLED=false
```

---

## 🔧 Troubleshooting

### "El PR de release-please no aparece"

- Verifica que tus commits siguen Conventional Commits (ver
  [`.github/COMMIT_CONVENTION.md`](../.github/COMMIT_CONVENTION.md))
- Sólo `feat`, `fix`, `perf`, `refactor`, `revert` activan release-please
- `chore`, `docs`, `style`, `ci`, `build`, `test` no bumpean versión
- Espera ~5 min después del push (Actions tarda en correr)

### "El build del .exe falla en Actions"

- Mira el log del run en `Actions → Station Installer (Windows .exe)`
- Errores comunes:
  - `npm ci` falla → ya cambiamos a `npm install` (commit `4037d5f`)
  - `makensis no recognized` → ya agregamos al PATH (commit `1bb2c67`)
  - `APP_VERSION already defined` → ya envolvimos en `!ifndef` (commit `920367c`)
- Si es nuevo, abre issue con el log

### "El release se creó pero sin el .exe"

- Significa que `station-installer.yml` falló después del release.
- Puedes re-disparar manualmente desde Actions → Run workflow → poner versión.

### "Quiero borrar un release publicado por error"

```bash
# Borrar tag local + remoto
git tag -d station-v5.1.0
git push origin :station-v5.1.0

# Borrar release desde la UI: github.com/.../releases → click → Delete
```

---

## 🎓 Convenciones del versionado (semver)

Seguimos [Semantic Versioning 2.0](https://semver.org/lang/es/):

```
MAJOR.MINOR.PATCH
  5    .1   .0
```

- **MAJOR**: cambio que **rompe** compatibilidad (breaking change).
  Ejemplo: cambiamos formato de `api_key`, las estaciones viejas dejan de funcionar.
- **MINOR**: nueva funcionalidad **compatible** con versiones anteriores.
  Ejemplo: nueva pantalla de provisioning con QR.
- **PATCH**: bug fix sin cambios funcionales.
  Ejemplo: arreglar timeout en sync.

Para forzar MAJOR, agrega `BREAKING CHANGE:` en el footer del commit:

```
feat(station)!: cambiar formato api_key a JWT firmado

BREAKING CHANGE: las api_key emitidas antes de v6.0 deben regenerarse
desde el panel.
```

---

## 📊 Histórico

Ver [`CHANGELOG.md`](../CHANGELOG.md) en la raíz del repo.

---

## 🔔 Notificación automática a clientes

Cuando se publica un release `station-v*`, el workflow `notify-release.yml`:

1. Lee la lista de empresas con al menos una estación activa
2. Inserta una notificación en `notificaciones` por cada empresa
3. La notificación aparece en `/notificaciones` del panel web al instante
4. Tipo: `system_release_available`, severidad: `info`
5. Dedupe: misma versión a la misma empresa solo una vez en 24h

### Secrets requeridos

En GitHub → Settings → Secrets and variables → Actions:

| Secret | Valor | Para qué |
|---|---|---|
| `SUPABASE_URL` | `https://ctmpsokjdguygjqmxyob.supabase.co` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | (de Supabase → Settings → API) | Bypass RLS para insertar a todas las empresas |

> ⚠️ **NUNCA** commitees la service role key. Solo va en GitHub Secrets.

Si los secrets no están configurados, el workflow hace skip silencioso
(no rompe el release).

## 🤝 Recursos

- [Conventional Commits](https://www.conventionalcommits.org/es/)
- [release-please docs](https://github.com/googleapis/release-please)
- [Semantic Versioning](https://semver.org/lang/es/)
- [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
