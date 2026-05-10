; ═════════════════════════════════════════════════════════════════════
;  Safe Link Station — Installer NSIS
;  Genera SafeLinkStation_Setup.exe con wizard de configuracion inicial.
;  Compilar con:  makensis installer.nsi
; ═════════════════════════════════════════════════════════════════════

Unicode True
SetCompressor /SOLID lzma

!define APP_NAME       "Safe Link Station"
!define APP_NAME_SLUG  "SafeLinkStation"
; APP_VERSION puede sobrescribirse desde linea de comandos:
;   makensis /DAPP_VERSION=5.2.0 installer.nsi
; Si no se pasa, usa el default "5.1.0"
!ifndef APP_VERSION
  !define APP_VERSION  "5.1.0"
!endif
!define APP_PUBLISHER  "Safe Link Monitoring"
!define APP_URL        "https://github.com/Safe-LM/app-login-trabajadores-desktop"
!define APP_EXE        "SafeLink_Station.exe"

; Carpeta donde PyInstaller deja el bundle (se pasa por -DBUNDLE_DIR=...)
!ifndef BUNDLE_DIR
  !define BUNDLE_DIR "..\dist\SafeLink_Station"
!endif

Name        "${APP_NAME}"
OutFile     "${APP_NAME_SLUG}_Setup_${APP_VERSION}.exe"
InstallDir  "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show
BrandingText "${APP_PUBLISHER}"

; Modern UI 2
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ─── Branding del wizard ─────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON   "..\src\assets\icon.ico"
!define MUI_UNICON "..\src\assets\icon.ico"

; ─── Paginas del wizard ──────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Pagina custom de configuracion (despues de instalar archivos)
Page custom ConfigPage ConfigPageLeave

; Pagina final
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Iniciar ${APP_NAME} ahora"
!define MUI_FINISHPAGE_LINK "Visitar el panel web"
!define MUI_FINISHPAGE_LINK_LOCATION "${APP_URL}"
!insertmacro MUI_PAGE_FINISH

; Paginas del uninstaller
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

; ─── Variables para la pagina custom ─────────────────────────────────
Var Dialog
Var LblNombre
Var TxtNombre
Var LblApiKey
Var TxtApiKey
Var LblSupabaseUrl
Var TxtSupabaseUrl
Var LblSupabaseKey
Var TxtSupabaseKey
Var LblIntro
Var ChkAutostart
Var ChkAutostartState

; ─── Pagina de configuracion ─────────────────────────────────────────
; Layout compacto para que TODOS los campos quepan en la pagina del
; wizard sin necesidad de scroll. Espaciado vertical: 18u por campo.
;
;   0u  - 16u: Intro (2 lineas)
;  20u  - 31u: Label "Nombre"   + TextBox
;  44u  - 55u: Label "API Key"  + TextBox
;  68u  - 79u: Label "URL"      + TextBox
;  92u  - 103u: Label "Anon Key" + TextBox
; 116u - 122u: Checkbox autostart
; Total: ~125u, cabe en los ~140u disponibles del wizard.
Function ConfigPage
  !insertmacro MUI_HEADER_TEXT "Configuracion inicial" \
    "Vincula esta estacion con tu cuenta de Safe Link Monitoring."

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; Intro (2 lineas)
  ${NSD_CreateLabel} 0 0 100% 16u \
    "Datos del panel web. Dejalos vacios si quieres configurarlos despues editando .env"
  Pop $LblIntro

  ; Nombre de la estacion
  ${NSD_CreateLabel} 0 20u 100% 9u "Nombre de la estacion:"
  Pop $LblNombre
  ${NSD_CreateText} 0 30u 100% 11u "Estacion-1"
  Pop $TxtNombre

  ; API Key
  ${NSD_CreateLabel} 0 44u 100% 9u "API Key (slm_...):"
  Pop $LblApiKey
  ${NSD_CreateText} 0 54u 100% 11u ""
  Pop $TxtApiKey

  ; Supabase URL
  ${NSD_CreateLabel} 0 68u 100% 9u "URL Supabase:"
  Pop $LblSupabaseUrl
  ${NSD_CreateText} 0 78u 100% 11u "https://ctmpsokjdguygjqmxyob.supabase.co"
  Pop $TxtSupabaseUrl

  ; Supabase Anon Key
  ${NSD_CreateLabel} 0 92u 100% 9u "Supabase Anon Key (publica, eyJ...):"
  Pop $LblSupabaseKey
  ${NSD_CreateText} 0 102u 100% 11u ""
  Pop $TxtSupabaseKey

  ; Checkbox: arrancar al iniciar Windows
  ${NSD_CreateCheckbox} 0 118u 100% 10u "Iniciar automaticamente con Windows"
  Pop $ChkAutostart
  ${NSD_Check} $ChkAutostart

  nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
  ${NSD_GetText} $TxtNombre $0
  ${NSD_GetText} $TxtApiKey $1
  ${NSD_GetText} $TxtSupabaseUrl $2
  ${NSD_GetText} $TxtSupabaseKey $3
  ${NSD_GetState} $ChkAutostart $ChkAutostartState

  ; Escribir .env en el directorio de instalacion
  FileOpen $4 "$INSTDIR\.env" w
  FileWrite $4 "# Generado por el instalador de Safe Link Station$\r$\n"
  FileWrite $4 "STATION_NAME=$0$\r$\n"
  FileWrite $4 "STATION_API_KEY=$1$\r$\n"
  FileWrite $4 "SUPABASE_URL=$2$\r$\n"
  FileWrite $4 "SUPABASE_KEY=$3$\r$\n"
  FileClose $4

  ; Autostart con Windows si esta marcado
  ${If} $ChkAutostartState == ${BST_CHECKED}
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
      "${APP_NAME_SLUG}" '"$INSTDIR\${APP_EXE}"'
  ${EndIf}
FunctionEnd

; ─── Seccion principal de instalacion ────────────────────────────────
Section "Aplicacion principal" SecApp
  SectionIn RO  ; obligatoria

  SetOutPath "$INSTDIR"
  ; Copiar TODO el bundle de PyInstaller (incluye DLLs, models, frontend, etc.)
  File /r "${BUNDLE_DIR}\*.*"

  ; Crear data dir para SQLite + cache
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\data\db"
  CreateDirectory "$INSTDIR\data\cache"
  CreateDirectory "$INSTDIR\logs"

  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut  "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"     "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut  "$SMPROGRAMS\${APP_NAME}\Desinstalar.lnk"     "$INSTDIR\Uninstall.exe"
  CreateShortcut  "$DESKTOP\${APP_NAME}.lnk"                    "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Registry: info para "Agregar/Quitar programas"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "DisplayName"     "${APP_NAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "Publisher"       "${APP_PUBLISHER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "URLInfoAbout"    "${APP_URL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "DisplayIcon"     "$INSTDIR\${APP_EXE}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "NoRepair" 1

  ; Tamano estimado en KB
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
    "EstimatedSize" "$0"

  ; Guardar ruta para futuros updates
  WriteRegStr HKLM "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\${APP_NAME}" "Version"    "${APP_VERSION}"

  ; Generar uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; ─── Uninstaller ─────────────────────────────────────────────────────
Section "Uninstall"
  ; Quitar autostart
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_NAME_SLUG}"

  ; Cerrar app si esta corriendo
  nsExec::Exec 'taskkill /F /IM ${APP_EXE}'

  ; Borrar shortcuts
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Desinstalar.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"

  ; Borrar archivos (deja data/ y logs/ por seguridad — solo el binario)
  ; Si quieres TOTAL nuke: descomenta la siguiente linea
  ; RMDir /r "$INSTDIR"

  ; Limpieza minima — el bundle de PyInstaller
  RMDir /r "$INSTDIR\_internal"
  Delete   "$INSTDIR\${APP_EXE}"
  Delete   "$INSTDIR\Uninstall.exe"
  ; Si el dir queda vacio, borrarlo
  RMDir "$INSTDIR"

  ; Limpiar registry
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
  DeleteRegKey HKLM "Software\${APP_NAME}"
SectionEnd
