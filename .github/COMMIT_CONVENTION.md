# Convención de Commits

Este proyecto usa [Conventional Commits](https://www.conventionalcommits.org/es/).
Los mensajes de commit siguen este formato:

```
<tipo>(<scope opcional>): <descripción corta en minúscula>

[cuerpo opcional]

[footer opcional, ej: BREAKING CHANGE: ..., Closes #123]
```

---

## Tipos permitidos

| Tipo | Cuándo usar | Bump versión | En CHANGELOG |
|---|---|---|---|
| **`feat`** | Nueva funcionalidad para el usuario | **minor** (5.1 → 5.2) | ✨ Nuevas funcionalidades |
| **`fix`** | Bug fix para el usuario | **patch** (5.1.0 → 5.1.1) | 🐛 Correcciones |
| **`perf`** | Mejora de performance | **patch** | ⚡ Performance |
| **`refactor`** | Refactor sin cambio de comportamiento | **patch** | ♻️ Refactors |
| **`revert`** | Revertir un commit anterior | **patch** | ⏪ Reverts |
| `docs` | Solo docs (README, comentarios) | — | (oculto) |
| `style` | Formato, espacios (no afecta código) | — | (oculto) |
| `chore` | Mantenimiento, deps, configs | — | (oculto) |
| `test` | Tests añadidos/modificados | — | (oculto) |
| `build` | Cambios al build system | — | (oculto) |
| `ci` | Cambios a CI/CD | — | (oculto) |

> ⚠️ Si tu commit incluye `BREAKING CHANGE:` en el footer **o** un `!` después
> del scope (ej: `feat(station)!:`), bumpea **major** (5.x → 6.0.0).

---

## Scopes recomendados

| Scope | Aplica a |
|---|---|
| `station` | Código en `station/` |
| `web-panel` | Código en `web-panel/` |
| `installer` | Cambios al instalador NSIS |
| `supabase` | Migraciones SQL, RPCs, RLS |
| `ci` | GitHub Actions |
| `docs` | Documentación del usuario |
| `deps` | Actualización de dependencias |

El scope es **opcional**. Si tu cambio es general, no lo pongas:
```
chore: actualizar README principal
```

---

## Ejemplos buenos

```
feat(station): pantalla de configuración de cámara

Permite seleccionar entre múltiples webcams conectadas y previsualizar
el feed antes de confirmar.

Closes #42
```

```
fix(web-panel): el toast de error no se cerraba al click

El timeout no se limpiaba al desmontar el componente, causando que
el toast persistiera en la siguiente página.
```

```
perf(station): reducir uso de RAM del matcher facial 40%

Cargar embeddings de Supabase con paginación de 50 en vez de todos
de golpe. Antes: ~600MB con 5000 empleados. Ahora: ~360MB.
```

```
feat(station)!: cambiar formato de api_key

BREAKING CHANGE: las api_key emitidas antes de v6.0 deben regenerarse
desde el panel. El formato cambió de UUID a JWT firmado.
```

---

## Ejemplos malos

❌ `update station` — falta tipo
❌ `Feat(station): nueva pantalla` — Mayúscula al inicio del subject
❌ `feat: arreglo bug del login` — debería ser `fix:`
❌ `fix: cambios varios` — descripción demasiado vaga
❌ `feat(station): nueva pantalla de provisioning con QR + lock por HWID + zero-touch` — header > 120 chars

---

## Cómo validamos

- **Localmente** (opcional): instala [`commitizen`](https://commitizen-tools.github.io/commitizen/)
  con `pip install commitizen` y commitea con `cz commit`.
- **CI**: el workflow `commit-lint.yml` corre en cada PR y bloquea
  el merge si hay commits que no cumplan.

---

## Cómo se traduce a releases

1. Commits a `main` con `feat:`, `fix:`, `perf:`, `refactor:` activan
   release-please.
2. release-please abre/actualiza un PR `chore(release): station X.Y.Z`
   con el `CHANGELOG.md` regenerado.
3. Al mergear ese PR:
   - Crea tag `station-vX.Y.Z`
   - Crea GitHub Release con notas categorizadas
   - Dispara `station-installer.yml` que compila y publica el `.exe`

Más detalles en [docs/RELEASES.md](../docs/RELEASES.md).
