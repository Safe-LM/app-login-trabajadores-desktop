# Changelog

Todos los cambios notables del proyecto se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y este
proyecto usa [Conventional Commits](https://www.conventionalcommits.org/es/) +
[Semantic Versioning](https://semver.org/lang/es/).

> A partir de la versión `5.2.0` este archivo se mantiene **automáticamente**
> por [release-please](https://github.com/googleapis/release-please).
> Solo edites manualmente entradas anteriores a esa versión.

---

## [5.1.0] — 2026-05-09

### ✨ Nuevas funcionalidades

- **Sistema completo de notificaciones SaaS multi-tenant**:
  Tabla `notificaciones` en Supabase con RLS por empresa, RPCs con dedupe,
  Realtime, página `/notificaciones` con filtros, browser push opcional,
  integración bidireccional estación→panel. ([4c73988])
- **Instalador NSIS profesional** con wizard de configuración inicial,
  shortcuts (escritorio + menú inicio), entrada en "Agregar/Quitar programas",
  autostart con Windows opcional. ([6562f33])
- **Auto-updater** contra GitHub Releases con verificación SHA256,
  opt-out vía `AUTO_UPDATE_ENABLED=false`. ([d1a70be])
- **Manual de instalación** para clientes en `docs/MANUAL_INSTALACION.md`. ([6562f33])

### 🎨 Rediseño completo del web-panel (premium UI)

- **Dashboard rediseñado** con StatCards premium (icons + delta % + sparklines),
  stagger animation de entrada. ([e7c803c])
- **Asistencia con timeline agrupado por hora**, sticky labels, badges
  semánticos por tipo (entrada/salida), confianza coloreada por umbral. ([b98108f])
- **Empleados con avatares HSL únicos** generados del nombre, hover
  accent lateral con scaleY animation. ([5a17fbe])
- **Sucursales con stats inline** (horario + tolerancia), pulse dot animado. ([c2e3da7])
- **Configuración sectioned** con icons semánticos por sección
  (azul/verde/rojo). ([c446e05])
- **Empty states ilustrados** con pulse rings y grid patterns. ([74a1a9c])
- **Sistema de botones unificado** (.btn .btn-primary/secondary/ghost/danger/success)
  con shimmer effect, glow, lift hover, scale active. ([275cc48])
- **PageHeader unificado** en 4 secciones con icon chip + stats + actions slot. ([840e105])

### ⚡ Performance

- **Realtime granular con debounce** en dashboard: 50 router.refresh()/min →
  1-2 queries/min con merge directo al state. ([53db2f9])
- **Modales pesados** extraídos a `dynamic()` imports en dispositivos:
  bundle inicial 14kB → 8.55kB. ([8534ea4])
- **Prefetch agresivo** del sidebar en `requestIdleCallback`. ([a37cfbc])
- **Optimistic updates** en mutations de empleados y dispositivos. ([0729c29])

### ♻️ Refactors

- **Tipos custom de RPCs Supabase** (de 13 → 8 `as any`). ([90b991a])
- **Sidebar a Tailwind** (proof of concept) con CSS vars mapeadas. ([4a21a4b])

### 🐛 Correcciones de CI

- Workflows preexistentes actualizados a estructura SaaS
  (src/ → station/src/, dashboard_nextjs/ → web-panel/). ([c37a473])
- Lint y security errors resueltos (flake8 + bandit). ([bea0ef0])
- supabase_sync_check reescrito para schema SaaS v2. ([512cd94])

### 🧹 Limpieza mayor del proyecto

- Eliminados 23,406 líneas de código legacy (dashboard_nextjs, dashboard_web,
  src/ raíz, database_fotos con 56 fotos, models/, data/). ([bcb946a])
- Reorganización de scripts dev a `tools/` con subcarpetas
  (diagnostics/, parsers/, migration/, enrollment/). ([bcb946a])
- 4 workflows CI nuevos: station-tests, station-build-windows,
  web-panel-typecheck, migration-validator. ([bcb946a])

### 📝 Documentación

- READMEs profesionales para `station/` y `web-panel/`. ([4647367])

[4c73988]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4c73988
[6562f33]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/6562f33
[d1a70be]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/d1a70be
[e7c803c]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/e7c803c
[b98108f]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/b98108f
[5a17fbe]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/5a17fbe
[c2e3da7]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c2e3da7
[c446e05]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c446e05
[74a1a9c]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/74a1a9c
[275cc48]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/275cc48
[840e105]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/840e105
[53db2f9]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/53db2f9
[8534ea4]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/8534ea4
[a37cfbc]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/a37cfbc
[0729c29]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/0729c29
[90b991a]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/90b991a
[4a21a4b]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4a21a4b
[c37a473]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/c37a473
[bea0ef0]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/bea0ef0
[512cd94]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/512cd94
[bcb946a]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/bcb946a
[4647367]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/4647367

---

## [5.0.0] — 2026-05-08

### ✨ Arquitectura SaaS multi-tenant completa

- **Schema SaaS v1**: tablas `empresas`, `sucursales`, `empleados`,
  `embeddings_faciales` (pgvector 128D), `dispositivos`,
  `registros_asistencia` con RLS por `empresa_id`. ([ada94f8])
- **Station PyQt5** rediseñada con UI React embebida (QWebEngineView):
  reconocimiento facial OpenCV DNN (YuNet + SFace), embeddings
  augmentados (10/empleado), sync nube↔local, heartbeat cada 60s,
  Realtime listener para comandos del panel.
- **Web-panel Next.js 15** con SSR, RLS multi-tenant, Realtime,
  API routes para CRUD de empleados/sucursales/dispositivos.
- **Provisioning zero-touch** con QR + HWID lock para activar
  estaciones de fábrica.
- **Edge Functions** para procesamiento de fotos en upload.

### 🎨 Login glassmorphism

- Rediseño del login con glassmorphism full-dark + orbs animados. ([657783a])
- Tipografía premium: Poppins + Inter + Plus Jakarta Sans. ([dcba48a])

[ada94f8]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/ada94f8
[657783a]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/657783a
[dcba48a]: https://github.com/Safe-LM/app-login-trabajadores-desktop/commit/dcba48a

---

## Versiones anteriores

Para versiones anteriores a v5.0.0 (arquitectura monolítica con SQLite local
y sin SaaS), revisa el historial completo en
[`git log`](https://github.com/Safe-LM/app-login-trabajadores-desktop/commits/main).
