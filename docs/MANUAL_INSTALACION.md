# Safe Link Station — Manual de Instalación

> **Para administradores de sucursal.** Este manual explica cómo instalar y configurar
> la estación de control de asistencia en una computadora Windows.

---

## ✅ Antes de empezar — qué necesitas

| Requisito | Detalle |
|---|---|
| 🖥️ Computadora | Windows 10 / 11 (64 bits) |
| 📷 Cámara | Webcam USB o integrada del laptop |
| 🌐 Internet | Estable (la primera vez para sincronizar) |
| 🔑 API Key | Te la dimos en el panel web (sección "Estaciones") |
| 📦 Instalador | Archivo `SafeLinkStation_Setup.exe` (te lo enviamos por email o descarga) |

> ⏱ **Tiempo estimado:** 3–5 minutos.

---

## 📥 Paso 1 — Descargar el instalador

Recibiste por email un link como:

```
https://github.com/Safe-LM/.../releases/download/station-v5.1.0/SafeLinkStation_Setup.exe
```

1. Click en el link → se descarga el archivo
2. Guárdalo en **Descargas** (donde sea fácil de encontrar)

---

## 🚀 Paso 2 — Ejecutar el instalador

1. Doble click sobre **`SafeLinkStation_Setup.exe`**
2. Windows mostrará un aviso de **"Editor desconocido"** (porque aún no firmamos el `.exe` digitalmente).
   Click en **"Más información"** → **"Ejecutar de todas formas"**.
3. Acepta el aviso de **Control de cuentas (UAC)** → "Sí"

Verás el wizard de instalación de Safe Link Station:

```
┌─────────────────────────────────────────────┐
│   Bienvenido al Asistente de Instalación   │
│                                             │
│   Safe Link Station 5.1.0                   │
│                                             │
│            [ Siguiente > ]  [ Cancelar ]   │
└─────────────────────────────────────────────┘
```

4. Click **Siguiente**

---

## 📂 Paso 3 — Carpeta de instalación

```
┌─────────────────────────────────────────────┐
│   Carpeta de Destino                        │
│                                             │
│   C:\Program Files\Safe Link Station\       │
│                              [ Examinar ]   │
│                                             │
│   Espacio requerido: ~280 MB                │
│   Espacio disponible: 142 GB                │
│                                             │
│         [ < Atrás ]  [ Siguiente > ]        │
└─────────────────────────────────────────────┘
```

Deja la ruta por defecto (`C:\Program Files\Safe Link Station\`) y click **Siguiente**.

> 💡 Si tu disco C: tiene poco espacio, puedes cambiar la ruta a `D:\Safe Link Station\`.

---

## ⚙️ Paso 4 — Configuración inicial

Después de copiar archivos (~1 min), aparecerá la **pantalla de configuración**:

```
┌──────────────────────────────────────────────────────────┐
│  Configuración inicial                                   │
│  Vincula esta estación con tu cuenta Safe Link.          │
│                                                          │
│  Nombre de la estación (ej: Sucursal Norte):             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Estacion-1                                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  API Key (la genera el panel al crear la estación):      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ sk_xxxxxxxxxxxxxxxxxxxxxxxxxxx                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  URL Supabase:                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │ https://ctmpsokjdguygjqmxyob.supabase.co           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Supabase Anon Key (pública):                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ eyJxxxxxx...                                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ☑ Iniciar automáticamente con Windows                  │
│                                                          │
│         [ < Atrás ]  [ Siguiente > ]                     │
└──────────────────────────────────────────────────────────┘
```

### Cómo obtener estos datos

1. **Nombre de la estación**: el que tú quieras. Ej: `"Recepción"`, `"Almacén Norte"`, `"Sucursal Centro"`.

2. **API Key**: 
   - Entra al panel web ([panel.safelink.app](https://panel.safelink.app))
   - Ve a **Estaciones** → click en **"Registrar estación"**
   - Ponle un nombre, asigna sucursal, y click en **"Registrar"**
   - Copia la **API Key** que aparece (empieza con `sk_...`)
   - 🚨 **Solo se muestra una vez** — guárdala bien

3. **URL Supabase** y **Anon Key**: viene precargada con los valores correctos. Si te dimos credenciales personalizadas, pégalas aquí.

4. **Iniciar con Windows**: marca esta casilla si quieres que la estación arranque sola al prender la computadora (recomendado para uso 24/7).

Click **Siguiente**.

---

## ✨ Paso 5 — Finalizar

```
┌─────────────────────────────────────────────┐
│   ¡Instalación completada!                  │
│                                             │
│   Safe Link Station se instaló              │
│   correctamente.                            │
│                                             │
│   ☑ Iniciar Safe Link Station ahora        │
│                                             │
│   🔗 Visitar el panel web                   │
│                                             │
│            [ Finalizar ]                    │
└─────────────────────────────────────────────┘
```

Click **Finalizar**.

---

## 🎬 Primera ejecución — qué pasa

1. La estación abre en pantalla completa (modo kiosco)
2. Pide acceso a la cámara (acepta cuando Windows lo pregunte)
3. Sincroniza la lista de empleados con Supabase (~30 segundos)
4. Por cada empleado con foto: genera **10 embeddings faciales** y los sube a la nube
5. Cuando aparece **"Listo — buscando rostro..."**, la estación está activa

> 📸 **Nota**: la primera sincronización puede tardar 1-2 min si hay muchos empleados.
> Verás "Sincronizando..." en la parte superior derecha.

---

## ✅ Verificar que está bien instalada

### En la estación
- [ ] Aparece logo "SAFE LINK MONITORING" en pantalla
- [ ] La cámara muestra video en vivo
- [ ] El indicador "EN LÍNEA" está verde (esquina superior derecha)
- [ ] Reloj en vivo
- [ ] Mensaje "Buscando rostro..." abajo de la cámara

### En el panel web (`panel.safelink.app`)
- [ ] Vé a **Estaciones**
- [ ] La estación nueva aparece con badge **"En línea"** (punto verde animado)
- [ ] Heartbeat reciente (hace <1 min)

---

## 🔧 Configurar después de instalar

Si quieres cambiar algo (nombre, autostart, API key), edita el archivo:

```
C:\Program Files\Safe Link Station\.env
```

Abre con **Bloc de notas como administrador** y modifica los valores. Reinicia la estación.

> ⚠️ Si **abres con doble click** sin "como administrador", Windows no te dejará guardar.

---

## 🗑️ Desinstalar

**Opción A — Desde menú Inicio:**
1. Menú Inicio → busca **"Safe Link Station"**
2. Click en **"Desinstalar"**

**Opción B — Desde Configuración:**
1. Configuración → Aplicaciones → Aplicaciones instaladas
2. Busca **"Safe Link Station"** → click en `⋯` → Desinstalar

> 💾 **Tus datos** (asistencias offline en `data/db/`, logs) se conservan por seguridad.
> Si quieres borrarlo todo, elimina manualmente la carpeta `C:\Program Files\Safe Link Station\` después de desinstalar.

---

## 🆘 Problemas comunes

| Problema | Solución |
|---|---|
| **"Editor desconocido"** al ejecutar el instalador | Normal sin firma digital. Click "Más información" → "Ejecutar de todas formas". |
| **"Cámara no disponible"** | Cierra Teams/Zoom/Skype/cualquier app que use cámara. Reinicia la estación. |
| **"Estación sin conexión"** en el panel | Verifica internet. La estación reintentará cada 60s. |
| **El instalador se cierra sin avisar** | Ejecuta como administrador (click derecho → "Ejecutar como administrador"). |
| **No genera embeddings** | Verifica que los empleados tengan foto subida en el panel. |
| **Cámara invertida o lateral** | Es una limitación de la cámara, no del software. |
| **No reconoce empleados nuevos** | Espera 60s tras crearlos en el panel — la sincronización es automática. |

---

## 🔄 Actualizaciones

La estación **te avisa cuando hay versión nueva** mediante una notificación.

- **Aceptar**: descarga e instala automáticamente
- **Rechazar**: sigues con la versión actual; te avisará la próxima vez

> 🚫 Si **NO quieres** auto-updates, agrega esta línea al `.env`:
> ```
> AUTO_UPDATE_ENABLED=false
> ```

---

## 📞 Soporte

- **Email**: soporte@safelink.app
- **Documentación técnica**: [github.com/Safe-LM/...](https://github.com/Safe-LM/app-login-trabajadores-desktop)
- **Logs locales**: `C:\Program Files\Safe Link Station\logs\`
- **Si necesitas reinstalar todo**: desinstala → borra carpeta → vuelve a instalar
