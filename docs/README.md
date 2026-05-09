# Safe Link — Sistema de control de asistencia con reconocimiento facial

Safe Link es una plataforma de control de asistencia para empresas, basada en
**reconocimiento facial** sobre estaciones físicas (kioscos) que se sincronizan
con un panel web administrado por el equipo de Safe Link.

## Componentes

| Componente | Descripción | Stack |
|---|---|---|
| **Estación** (`station/`) | App de escritorio en cada sucursal del cliente. Reconoce caras, registra entradas/salidas. | Python 3.10+, PyQt5, OpenCV, React (UI) |
| **Panel web** (`web-panel/`) | App web para admins (de Safe Link y de cada empresa). Gestiona empleados, estaciones, reportes. | Next.js 15, React 19, Supabase |
| **Supabase** (`supabase/`) | Backend serverless: base de datos PostgreSQL, autenticación, Realtime, Edge Functions, Storage. | Supabase Cloud |

## Quick links

- 📘 **Levantar una estación nueva** → [docs/runbook-estacion.md](runbook-estacion.md)
- 📗 **Levantar el panel web (desarrollo)** → [docs/runbook-panel.md](runbook-panel.md)
- 🗺️  **Arquitectura del sistema** → [docs/arquitectura.md](arquitectura.md)
- 🔧 **Troubleshooting común** → [docs/troubleshooting.md](troubleshooting.md)

## Flujo end-to-end (resumen)

```
1. Admin crea empleado en panel web (con foto)
2. Edge Function marca empleado como pendiente de embedding
3. Estación recibe comando de sync por Realtime (<1s)
4. Estación descarga foto, genera embedding facial, sube a Supabase
5. Empleado se acerca a la cámara → reconocimiento → registro
6. Panel web muestra el registro EN VIVO (sin refresh)
```

## Roles

- **Superadmin** (equipo Safe Link): ve todas las empresas, gestiona la plataforma
- **Admin de empresa**: gestiona empleados, sucursales y estaciones de su empresa
- **Estación**: dispositivo físico autenticado por `api_key` única + HWID
- **Empleado**: no tiene acceso al panel; solo se reconoce facialmente

## Estado del proyecto

Ver [PLAN.md](PLAN.md) para roadmap detallado por sprints.

## Soporte

- Issues: GitHub Issues
- Slack: #safe-link-dev
- Email: dev@safelink.app
