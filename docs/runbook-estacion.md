# Runbook: Levantar una estación nueva

Este documento explica cómo activar una estación Safe Link en una sucursal de
un cliente, **paso a paso, sin tocar archivos ni terminales**.

---

## Pre-requisitos

| Requisito | Detalle |
|---|---|
| Hardware | PC con Windows 10/11 (mínimo i3, 8 GB RAM) |
| Cámara | Webcam USB (1080p recomendado) o cámara integrada |
| Red | Internet estable (WiFi o Ethernet) — debe alcanzar `*.supabase.co` |
| Cuenta admin | Acceso al panel web (`panel.safelink.app`) |

---

## Paso 1 — Instalar la app de la estación

1. En la PC, abre el navegador
2. Ve a `https://releases.safelink.app/latest`
3. Descarga `SafeLinkStation-Setup.exe` (~200 MB)
4. Doble click → **Siguiente → Siguiente → Instalar**
5. Acepta el permiso de cámara cuando lo pida Windows

> **Tip:** Si te pide permisos de administrador, dale Sí. Solo es para crear
> el acceso directo y configurar autoinicio.

---

## Paso 2 — Primer arranque

1. Doble click en el ícono **Safe Link** del escritorio
2. Aparece un splash screen con el logo
3. Espera ~5 segundos
4. La estación detecta que no está activada y muestra:

```
┌──────────────────────────────────────────┐
│              🛡️  SAFE LINK               │
│                                          │
│         Activa esta estación             │
│                                          │
│        ┌───────────────────┐             │
│        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │             │
│        │ ▓ Código QR     ▓ │             │
│        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │             │
│        └───────────────────┘             │
│                                          │
│         CÓDIGO: ABC-123-XYZ              │
│                                          │
│   Escanea con tu celular o ingresa el    │
│   código en panel.safelink.app/activar   │
│                                          │
│        ⏳ Esperando activación...         │
└──────────────────────────────────────────┘
```

---

## Paso 3 — Activar desde el panel

**Opción A — Escanear el QR (recomendado)**

1. Saca tu celular
2. Abre la cámara
3. Apunta al QR
4. Toca la notificación que aparece → abre el navegador
5. Si no estás logueado, ingresa al panel
6. La página `/activar` se abre con el token pre-rellenado

**Opción B — Ingresar el código manual**

1. En cualquier dispositivo, ve a `https://panel.safelink.app/activar`
2. Escribe el código que ves en la estación: `ABC-123-XYZ`
3. Click **Continuar**

---

## Paso 4 — Confirmar la asignación

En la página `/activar`, completa:

```
  ▼ Empresa:    [ Acme Corp           ]
  ▼ Sucursal:   [ Centro              ]
  📝 Nombre:    [ Recepción Principal ]

  [   ✓ Activar estación    ]
```

Click en **Activar estación**.

---

## Paso 5 — Listo

En menos de 3 segundos:

1. La estación recibe la activación por Realtime
2. Muestra: **"✅ Activada como: Recepción Principal — Sucursal Centro"**
3. Se reinicia sola (2 segundos)
4. Aparece el dashboard con la cámara funcionando
5. Empezarán a sincronizarse los empleados en background

**La estación ya puede registrar asistencias.**

---

## Troubleshooting

| Síntoma | Solución |
|---|---|
| **No aparece QR, dice "Sin conexión"** | Verifica WiFi/cable. Pide al equipo IT que permita `*.supabase.co` en el firewall |
| **El QR aparece pero al escanear dice "token expirado"** | Cierra la estación y vuelve a abrirla — generará un token nuevo (válido 15 min) |
| **Activé pero la estación sigue mostrando el QR** | Espera 10s. Si persiste: cierra y abre la app. La config quedó guardada local. |
| **La cámara no inicia** | 1) Cierra otras apps que usen cámara (Skype, Teams). 2) En la estación: **Panel Supervisor → Reiniciar cámara** |
| **Dice "OFFLINE" en heartbeat** | Verifica internet. La estación puede operar offline pero no sincroniza nuevos empleados |
| **Quiero mover esta estación a otra sucursal** | Desde el panel: **Estaciones → click en la estación → Re-asignar**. La estación detecta el cambio en <30s |

---

## Logs y diagnóstico

Si algo falla, los logs viven en:

- Windows: `%LOCALAPPDATA%\SafeLink\logs\station.log`
- Linux: `~/.local/share/safelink/logs/station.log`

Manda este archivo a soporte (`support@safelink.app`).

---

## Desinstalar

1. Panel de Control → Programas → Safe Link Station → Desinstalar
2. Borra la carpeta `%LOCALAPPDATA%\SafeLink\` para limpiar config local
3. En el panel web, elimina la estación: **Estaciones → ⋮ → Eliminar**
