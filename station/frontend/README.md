# Safe Link Station — Frontend (React UI embebida)

> UI de la estación kiosko, embebida en `QWebEngineView` del proceso PyQt5.
> React 18 · TypeScript · Vite · Tailwind v3 · Framer Motion · Zustand.

## Para qué sirve

Este subproyecto compila a **un único `dist/index.html`** (CSS + JS inlineados via `vite-plugin-singlefile`) que el proceso Python (`station/src/windows/dashboard_window.py`) carga dentro de un `QWebEngineView` para renderizar la UI del kiosko.

```
Python (PyQt5)
  └── QWebEngineView
        └── React App (dist/index.html — bundle inline)
              └── QWebChannel bridge ↔ Python
```

Cuando un empleado se para frente a la cámara:
1. Python detecta el rostro con YuNet+SFace
2. Empuja métricas + bbox a la UI via `window.updateFrame(b64)`
3. React dibuja el feed + bbox verde + tarjeta de empleado identificado
4. Tras 4s de confirmación, vuelve al estado idle (modo kiosko)

## Requisitos

- Node 20+
- npm 10+

## Scripts

```bash
npm install        # Instalar dependencias
npm run dev        # Vite dev server en localhost:5173 (para HMR)
npm run build      # Build producción → dist/index.html (single file)
npm run preview    # Servir dist/ local para inspeccionar
npm run lint       # ESLint
```

## Desarrollo con hot reload

```bash
# Terminal 1: Vite dev server
cd station/frontend
npm run dev

# Terminal 2: estación apuntando al dev server
cd station
STATION_DEV=1 python run_station.py
```

`STATION_DEV=1` hace que `dashboard_window.py` cargue `http://localhost:5173` en lugar de `frontend/dist/index.html`. Los cambios en React se reflejan al instante sin recompilar Python.

## Build producción

```bash
npm run build
```

Output: `dist/index.html` (~370 KB, CSS + JS inlineados). PyInstaller lo empaqueta dentro del `.exe` (ver `station/SafeLink_Station.spec`).

## Bridge Python ↔ React

### Python → React (globals)

Python llama estas funciones JavaScript via `runJavaScript()`:

| Función | Cuándo | Payload |
|---|---|---|
| `setStatus(text, kind)` | Cambio de estado del sistema | `kind`: `''`, `'ok'`, `'warn'`, `'bad'` |
| `setStationInfo(name, branch)` | Al arrancar (post-config) | nombre estación, sucursal |
| `setConnectivity(online, msg)` | Cambio online/offline | bool + razón |
| `setCamState(state)` | Estado de la cámara | `'offline'`, `'connecting'`, `'preparing'`, `'live'`, `'error'` |
| `updateFrame(b64)` | Cada ~40ms | JPEG base64 con bbox dibujado |
| `setEmployeeInfo(...)` | Match exitoso | nombre, apellido, zona, sucursal, puesto |
| `setAvatar(b64)` | Match exitoso | foto del empleado en cache |
| `setConfidence(pct)` | Cada intento | 0-100, o -1 para reset |
| `showAttendanceConfirmed(...)` | Asistencia registrada | nombre, tipo, hora, avatar |
| `showNotRecognized()` | Tras 3s sin match | — |
| `showAlreadyRegistered(tipo, hora)` | Doble fichaje en <60s | — |
| `setBadgeText(text)` | Badge de la cámara | "ESPERA 3S", etc. |
| `setLastReg(text, color)` | Último registro del día | — |
| `setHealth(score, emps, cam, enc)` | Cada heartbeat | salud del sistema |
| `addRecentRecord(nombre, tipo, hora)` | Registro nuevo | aparece en panel derecho |
| `resetEmployee()` | Tras 4s del registro | limpia tarjeta de empleado |

### React → Python (bridge)

`src/lib/bridge.ts` expone el `bridge` global registrado por `QWebChannel`:

```ts
window.bridge.startCamera();
window.bridge.stopCamera();
window.bridge.registerAttendance();   // registro manual
window.bridge.startEnrollment();      // abrir wizard
window.bridge.logout();               // soft reset (modo kiosko)
window.bridge.syncEmployees();        // force sync con backend
window.bridge.relaunchSetup();        // re-provisioning
```

## Restricciones del entorno (Chrome 83)

PyQt5 5.15 trae Chromium 83. Eso limita varias features modernas:

- ❌ `@layer` CSS → **Tailwind v3** (no v4)
- ❌ `import.meta.resolve` → sin plugin `legacy`
- ❌ `AudioContext` autoplay sin gesto → silenciado (beep real va por `winsound` en Python)
- ❌ Service Workers
- ✅ `type="module"` funciona
- ✅ Framer Motion + Zustand funcionan

## Stack

| Lib | Rol |
|---|---|
| React 18 | UI |
| TypeScript | Tipado estático |
| Vite 6 | Bundler |
| `vite-plugin-singlefile` | Inline CSS + JS en un solo HTML |
| Tailwind v3 | Estilos |
| Framer Motion | Animaciones del overlay de confirmación |
| Zustand | Estado global (cámara, empleado, salud) |
| lucide-react | Iconos |

## Estructura

```
src/
├── App.tsx                        # Layout principal kiosko + overlays
├── main.tsx                       # Entry + montaje React
├── lib/
│   ├── bridge.ts                  # Init de QWebChannel
│   ├── sound.ts                   # Web Audio API (bail-out si suspended)
│   └── useIdleReset.ts            # Hook para auto-reset tras inactividad
└── store/
    └── useStore.ts                # Zustand store
```

## Troubleshooting

| Problema | Solución |
|---|---|
| Página en blanco en el `.exe` | `frontend/dist/index.html` no se generó o no se incluyó en el bundle. Verifica `npm run build` y `SafeLink_Station.spec` |
| HMR no funciona en modo dev | El proceso Python no está apuntando al dev server. Set `STATION_DEV=1` |
| `Bridge initialized` no aparece en consola | `qwebchannel.js` no se cargó. PyQt5 expone `qrc:///qtwebchannel/qwebchannel.js`; revisa que el `<script>` esté en `index.html` |
| Estilos rotos en producción pero OK en dev | Tailwind purgó clases dinámicas. Agregar las clases a `tailwind.config.js → safelist` |
