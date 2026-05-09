# Installer NSIS — Safe Link Station

Genera el `.exe` instalable que reciben los clientes.

## Cómo se compila (manual, en una máquina Windows)

1. Construir el bundle de PyInstaller:
   ```powershell
   cd station
   pyinstaller SafeLink_Station.spec --noconfirm
   ```
   Esto deja todo en `station/dist/SafeLink_Station/`.

2. Compilar el frontend React (si no se hizo antes):
   ```powershell
   cd frontend
   npm ci
   npm run build
   ```

3. Compilar el instalador con NSIS:
   ```powershell
   cd ..\installer
   makensis installer.nsi
   ```
   Genera `SafeLinkStation_Setup_5.1.0.exe` en la misma carpeta.

## Cómo se compila automáticamente

El workflow `.github/workflows/station-installer.yml` hace todo lo
anterior cada vez que pusheas un tag `station-v*`:

```bash
git tag station-v5.1.0
git push origin station-v5.1.0
```

GitHub Actions:
1. Compila PyInstaller (Windows)
2. Compila Vite (frontend React)
3. Instala NSIS y compila el instalador
4. Sube `SafeLinkStation_Setup_X.X.X.exe` a GitHub Releases
5. Genera `version.txt` y `SHA256SUMS.txt` para el auto-updater

## Personalización

- **Versión**: edita `!define APP_VERSION` en `installer.nsi` (o se sobrescribe
  desde CI con `-DAPP_VERSION=5.1.0`).
- **Branding**: cambia `!define APP_PUBLISHER` y `!define APP_URL`.
- **Iconos**: usa `station/src/assets/icon.ico`.
- **Páginas custom**: la página `ConfigPage` pide los datos de Supabase
  durante la instalación. Si quieres más campos, edítalos en la sección
  "Pagina custom de configuracion".

## Requisitos

- **Windows** (NSIS no compila en Linux/macOS sin Wine)
- **NSIS 3.x** instalado y en PATH ([descargar](https://nsis.sourceforge.io/Download))
- **PyInstaller 6.x**
- **Python 3.10**
- **Node 20** (para compilar el frontend)
