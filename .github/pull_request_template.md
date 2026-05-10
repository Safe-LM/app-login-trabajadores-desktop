<!--
Gracias por contribuir. Antes de mergear, asegúrate de marcar el checklist abajo.
El título del PR debe seguir Conventional Commits, ej:
   feat(station): nueva pantalla de provisioning
   fix(web-panel): toast no se cerraba
Más detalles en .github/COMMIT_CONVENTION.md
-->

## 📋 Resumen

<!-- ¿Qué cambia este PR? Una o dos frases. -->



## 🎯 ¿Por qué?

<!-- Contexto: bug que arregla, problema del usuario, motivación. -->



## 📐 Tipo de cambio

<!-- Marca con [x] el(los) que aplique(n). -->

- [ ] 🐛 Bug fix (cambio que arregla un problema sin romper nada)
- [ ] ✨ Feature (cambio que agrega funcionalidad)
- [ ] ⚡ Performance (cambio que mejora velocidad/memoria sin cambiar comportamiento)
- [ ] ♻️ Refactor (cambio interno sin afectar al usuario)
- [ ] 💥 Breaking change (rompe compatibilidad — requiere `BREAKING CHANGE:` en el commit)
- [ ] 📝 Docs / 🎨 Style / 🧪 Tests / 🧹 Chore

## 🧪 Cómo se probó

<!-- Pasos manuales / automated tests que corrieron / cobertura. -->

- [ ] Probado localmente con `python run_station.py`
- [ ] Type-check pasa: `npm run type-check` (web-panel)
- [ ] Tests unit: `pytest` (station)
- [ ] No rompe el build: `pyinstaller SafeLink_Station.spec`

## 📸 Screenshots / videos

<!-- Si tocaste UI, agrega antes/después. -->



## ✅ Checklist final

- [ ] El título del PR sigue Conventional Commits
- [ ] Mis commits siguen Conventional Commits
- [ ] Actualicé docs si lo amerita (README, MANUAL_INSTALACION.md, RELEASES.md)
- [ ] No hay secrets / API keys hardcoded
- [ ] CI pasa (commit-lint, station-tests, web-panel-typecheck)

## 🔗 Issues relacionados

<!-- Closes #123, Refs #456 -->

Closes #
