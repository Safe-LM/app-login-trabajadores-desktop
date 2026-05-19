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
1. Admin crea empleado en panel web (con foto drag & drop)
2. Foto sube a Supabase Storage (fotos-empleados/<empresa>/<empleado>.jpg)
3. Edge Function 'generate-embedding' marca empleado como enrollado=false
4. Trigger SQL + RPC notificar_sync_empleados encolan comando para las
   estaciones de la empresa
5. Estación recibe el comando vía Realtime (<500ms)
6. Estación descarga foto, genera 10 embeddings con data augmentation
   (crop centrado + flip + brillo + rotaciones + ruido + blur) usando
   YuNet + SFace, sube via subir_embeddings_estacion_batch
7. Empleado se acerca a la cámara → YuNet detecta cara → SFace embedding
   → cosine match vs cache local → si pasa threshold (0.40) + gap + quality
   gate, dispara _auto_register → INSERT local + RPC registrar_asistencia_station
8. Panel web muestra el registro EN VIVO via Realtime subscription
9. Logs de cada intento de reconocimiento suben a logs_estacion para
   diagnóstico remoto sin acceso físico al kiosko
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
