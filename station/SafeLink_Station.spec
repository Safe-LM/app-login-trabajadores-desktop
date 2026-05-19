# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec — Safe Link Station

Genera bundle --onedir en station/dist/SafeLink_Station/.
NSIS (installer.nsi) lo empaqueta como SafeLinkStation_Setup.exe.

Para construir manualmente:
    cd station
    pyinstaller SafeLink_Station.spec --noconfirm
"""

from pathlib import Path

block_cipher = None

# ─── DATOS A INCLUIR ──────────────────────────────────────────────────
datas = [
    # Iconos, logos
    ("src/assets", "src/assets"),
    # Credenciales Supabase embebidas (defaults read-only del fabricante).
    # Se cargan en _bootstrap_env() para que el .exe arranque sin que el
    # operario tenga que configurar SUPABASE_URL / SUPABASE_KEY.
    ("src/config/server.env", "config"),
]

# Frontend React compilado (UI embebida) — solo si fue compilado
frontend_dist = Path("frontend/dist")
if frontend_dist.exists() and any(frontend_dist.iterdir()):
    datas.append(("frontend/dist", "frontend/dist"))

# Modelos ONNX YuNet + SFace (auto-descargables si no estan al instalar)
models_dir = Path("models")
if models_dir.exists():
    for m in models_dir.glob("*.onnx"):
        datas.append((str(m), "models"))

# ─── HIDDEN IMPORTS ───────────────────────────────────────────────────
# PyInstaller no detecta imports dinamicos / via string
hiddenimports = [
    # Qt WebEngine (carga UI React)
    "PyQt5.QtWebEngineWidgets",
    "PyQt5.QtWebEngineCore",
    "PyQt5.QtWebChannel",
    "PyQt5.QtMultimedia",
    "PyQt5.QtMultimediaWidgets",

    # OpenCV
    "cv2",

    # SQLAlchemy dialects (sino: NoSuchModuleError en runtime)
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.sql.default_comparator",

    # Supabase deps cargadas dinamicamente
    "postgrest",
    "gotrue",
    "realtime",
    "storage3",
    "supafunc",
    "websockets",
    "httpx",

    # qrcode + Pillow
    "qrcode",
    "PIL.Image",
    "PIL._tkinter_finder",

    # pandas
    "pandas._libs.tslibs.base",

    # Modulos propios cargados dinamicamente
    "utils.face_recognition_opencv",
    "utils.hybrid_opencv_gemini_matcher",
    "utils.photo_to_photo_matcher",
    "utils.realtime_listener",
    "utils.sync_manager",
    "utils.station_manager",
    "utils.recognition_health",
    "utils.auto_updater",
]

# ─── EXCLUIR LIBRERIAS PESADAS NO USADAS ──────────────────────────────
excludes = [
    # PyTorch + ML pesado solo se usa en scripts dev (tools/)
    "torch",
    "torchvision",
    "torchaudio",
    "ultralytics",
    "scikit-image",
    "skimage",
    "sklearn",
    "albumentations",
    # Backends matplotlib que opencv arrastra a veces
    "matplotlib",
    "tkinter",
    "PyQt6",
    "PySide2",
    "PySide6",
    # IPython/Jupyter
    "IPython",
    "notebook",
    "jupyter",
    # No usamos Postgres directo en runtime, solo HTTPS via supabase-py
    "psycopg2",
    "psycopg2-binary",
]

a = Analysis(
    ["src/main.py"],
    pathex=["src"],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="SafeLink_Station",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[
        # No comprimir Qt DLLs (puede romper carga dinamica)
        "Qt5Core.dll",
        "Qt5Gui.dll",
        "Qt5Widgets.dll",
        "Qt5WebEngineCore.dll",
        "QtWebEngineProcess.exe",
        "vcruntime140.dll",
        "vcruntime140_1.dll",
    ],
    console=False,  # Oculta terminal (modo windowed)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="src/assets/icon.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[
        "Qt5Core.dll",
        "Qt5Gui.dll",
        "Qt5Widgets.dll",
        "Qt5WebEngineCore.dll",
        "QtWebEngineProcess.exe",
        "vcruntime140.dll",
        "vcruntime140_1.dll",
    ],
    name="SafeLink_Station",
)
