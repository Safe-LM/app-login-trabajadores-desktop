"""
Script para procesar y copiar fotos a la base de datos.
"""
from pathlib import Path
from utils.process_photos import process_photos_folder

def main():
    """Procesar fotos de la carpeta photos/ a database_fotos/."""
    # Rutas
    base_dir = Path(__file__).parent
    photos_dir = base_dir.parent / "photos"
    database_fotos_dir = base_dir / "database_fotos"
    
    print("=" * 50)
    print("Procesando fotos para base de datos")
    print("=" * 50)
    print(f"Origen: {photos_dir}")
    print(f"Destino: {database_fotos_dir}")
    print()
    
    if not photos_dir.exists():
        print(f"[ERROR] No se encontro la carpeta: {photos_dir}")
        return
    
    # Procesar fotos
    processed = process_photos_folder(photos_dir, database_fotos_dir)
    
    print()
    print("=" * 50)
    print(f"[OK] Procesadas {processed} fotos")
    print("=" * 50)

if __name__ == "__main__":
    main()

