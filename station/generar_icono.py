import os
from PIL import Image

def generate_icons():
    # Rutas
    base_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(base_dir, "src", "assets")
    
    # Buscar el logo (intentar varios nombres comunes)
    logo_candidates = ["logo.png", "logo.jpg", "logo.jpeg", "SafeLinkLogo.png"]
    logo_path = None
    
    for cand in logo_candidates:
        p = os.path.join(assets_dir, cand)
        if os.path.exists(p):
            logo_path = p
            break
            
    if not logo_path:
        print(f"[ERROR] No se encontro el logo en {assets_dir}")
        print("Por favor, guarda tu imagen como 'logo.png' dentro de la carpeta 'src/assets'")
        return

    print(f"[INFO] Procesando logo: {logo_path}")
    img = Image.open(logo_path)
    
    # 1. Generar icon.ico (para Windows y el .exe)
    ico_path = os.path.join(assets_dir, "icon.ico")
    # Tamaños estandar para Windows ICO
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format="ICO", sizes=icon_sizes)
    print(f"[SUCCESS] Icono generado: {ico_path}")

if __name__ == "__main__":
    try:
        generate_icons()
    except Exception as e:
        print(f"[ERROR] Ocurrio un error: {e}")
