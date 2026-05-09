import subprocess
import sys
import os
import time
from pathlib import Path

def run_production():
    """Corre la estación usando el build de React ya existente."""
    print("🚀 Iniciando Safe Link Station (Producción)...")
    dist_path = Path("frontend/dist")
    
    if not dist_path.exists():
        print("⚠️ No se encontró la carpeta 'dist'. Compilando frontend primero...")
        build_frontend()
    
    # Correr el main de Python
    subprocess.run([sys.executable, "src/main.py"])

def build_frontend():
    """Compila el frontend de React."""
    print("📦 Compilando Frontend React...")
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("❌ Error: No se encuentra la carpeta 'frontend'")
        return
    
    subprocess.run("npm run build", shell=True, cwd=str(frontend_dir))

def run_dev():
    """Corre Vite y Python al mismo tiempo en una sola terminal."""
    print("🛠️ Iniciando Modo Desarrollo (React + Python)...")
    frontend_dir = Path("frontend")
    
    # 1. Iniciar Vite en segundo plano
    os.environ["STATION_DEV"] = "1"
    vite_proc = subprocess.Popen("npm run dev", shell=True, cwd=str(frontend_dir))
    
    print("⏳ Esperando a que Vite inicie...")
    time.sleep(3) # Esperar a que el server de Vite esté listo
    
    try:
        # 2. Correr Python
        # Nota: Asegúrate de que en dashboard_window.py tengas la URL de localhost para dev
        subprocess.run([sys.executable, "src/main.py"])
    finally:
        # Al cerrar Python, matamos Vite
        print("🛑 Cerrando servidores...")
        vite_proc.terminate()

if __name__ == "__main__":
    # Si pasas el argumento 'dev', corre modo desarrollo
    if len(sys.argv) > 1 and sys.argv[1] == "dev":
        run_dev()
    elif len(sys.argv) > 1 and sys.argv[1] == "build":
        build_frontend()
    else:
        run_production()
