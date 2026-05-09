# Plan de desarrollo Safe Link

Roadmap por sprints. Cada sprint dura 1-2 semanas.

## ✅ Implementado en esta sesión

### Sprint 0 — Documentación y deployabilidad
- [x] [README.md](README.md) ejecutivo
- [x] [runbook-estacion.md](runbook-estacion.md) — paso a paso para activar estación
- [x] [runbook-panel.md](runbook-panel.md) — setup del panel web
- [x] [arquitectura.md](arquitectura.md) — diagramas y decisiones de diseño
- [x] `scripts/setup-dev.ps1` — one-command setup en Windows

### Sprint 1 — Onboarding zero-touch con QR
- [x] DB: tabla `provisioning_tokens` + 4 RPCs (`crear`, `validar`, `activar`, `obtener`)
- [x] DB: HWID fingerprint validation
- [x] DB: Realtime activado sobre `provisioning_tokens`
- [x] Estación: `utils/hwid.py` (fingerprint estable Windows + Linux)
- [x] Estación: `utils/provisioning_service.py` (servicio orquestador)
- [x] Estación: `windows/activation_window.py` (UI premium con QR)
- [x] Estación: integración en `main.py`
- [x] Panel: página pública `/activar?token=...`
- [x] Panel: cliente con validación + activación + animaciones
- [x] Panel: estética alineada (dark, glassmorphism, accent azul)

### Mejoras previas (otras sesiones)
- [x] Fix: `notificar_sync_empleados` con empresa_id correcto
- [x] Realtime listener para `comandos_estacion` en estación
- [x] Realtime para `registros_asistencia` en panel (badge "EN VIVO")
- [x] Cache paths corregidos (`json/employees_db.json`)
- [x] Servicios escalonados con QTimer (no bloquean UI)

---

## 🚧 Pendiente

### Sprint 2 — Dashboard de flota en vivo (1.5 semanas)
- [ ] Vista grid de estaciones con tarjetas en vivo
- [ ] Drill-down: log + métricas detalladas
- [ ] Botones acción remota (sync, restart, clear cache)
- [ ] Alertas: estación offline >5 min → email/push
- [ ] Snapshot bajo demanda (foto cámara remota)

### Sprint 3 — Empleados y reportes (1.5 semanas)
- [ ] Importación masiva CSV/Excel + ZIP de fotos
- [ ] Página de empleado con timeline
- [ ] Reportes auto-generados (PDF semanal/mensual)
- [ ] Export Excel
- [ ] Re-enrollar empleado

### Sprint 4 — Seguridad y multi-tenant (1 semana)
- [ ] Rol `superadmin` (tu equipo ve todo)
- [ ] Audit log inmutable
- [ ] Detección de fraude
- [ ] Liveness detection (parpadeo)
- [ ] Política de retención GDPR

### Sprint 5 — Polish (1 semana)
- [ ] Branding por empresa (logo, colores)
- [ ] Notificaciones unificadas
- [ ] Horarios laborales
- [ ] Subdominio por empresa
- [ ] i18n (es/en)

### Sprint 6 — Estación pro (1 semana)
- [ ] Auto-update silencioso
- [ ] Modo offline-first robusto
- [ ] Modo kiosco (anti-tamper)
- [ ] Audio feedback ("Bienvenido Juan")
- [ ] Voice prompts ("Acércate más")

### Sprint 7 — IA (futuro)
- [ ] Predicción de ausencias
- [ ] Detección de uniformes
- [ ] Asistente IA en panel

---

## Después de esta sesión, qué hacer

### 1. Aplicar las migraciones nuevas

Desde el dashboard de Supabase → SQL Editor, ejecuta:

1. `supabase/migrations/20260503_fix_notificar_sync_empresa_id.sql`
2. `supabase/migrations/20260507_enable_realtime.sql`
3. `supabase/migrations/20260508_provisioning_zero_touch.sql` ⭐ nueva

### 2. Instalar la nueva dependencia en estación

```bash
cd station
pip install qrcode[pil]
```

### 3. Probar el flujo zero-touch

1. **Borra** `station/data/station_config.json` y `station/.env` (si tiene STATION_API_KEY)
2. Corre la estación: `python run_station.py`
3. Debería aparecer la pantalla de activación con QR + código
4. En el panel web (logueado como admin) ve a `/activar` y pega el código
5. Selecciona empresa + sucursal → click "Activar"
6. La estación recibe la activación en <2 segundos vía Realtime
7. Aparece pantalla de éxito → carga el dashboard

### 4. Si quieres cargar texto cómodamente

Después de activarse exitosamente, si más adelante quieres cambiar la estación
de sucursal, ya no hay que tocar nada en la PC: borrar la fila desde el panel
y la estación detecta y muestra QR de nuevo.
