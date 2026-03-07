"""
Script para extraer información de empleados del PDF y crear un CSV.
Detecta automáticamente si el PDF es formato tabla o formato texto.
"""
from pathlib import Path
from utils.pdf_parser import create_csv_from_pdf
from utils.pdf_parser_table import create_csv_from_table_pdf

def main():
    """Extraer empleados del PDF y crear CSV."""
    base_dir = Path(__file__).parent
    
    # Buscar el PDF (priorizar "PERSONAL TIENDAS BM.pdf" que tiene formato tabla)
    pdf_path = base_dir / "PERSONAL TIENDAS BM.pdf"
    if not pdf_path.exists():
        pdf_path = base_dir / "plantilla_personal_por_zona_sucursal.pdf"
    
    output_csv = base_dir / "employees_from_pdf.csv"
    
    print("="*60)
    print("EXTRACCION DE EMPLEADOS DEL PDF")
    print("="*60)
    print()
    
    if not pdf_path.exists():
        print(f"[ERROR] No se encontro el PDF")
        print(f"  Buscando en: {base_dir}")
        pdf_files = list(base_dir.glob("*.pdf"))
        if pdf_files:
            print(f"  PDFs encontrados:")
            for pdf in pdf_files:
                print(f"    - {pdf.name}")
        return
    
    print(f"[OK] Usando PDF: {pdf_path.name}")
    
    # Detectar formato del PDF
    if "PERSONAL TIENDAS BM" in pdf_path.name or "BM" in pdf_path.name:
        print("[INFO] Detectado formato de tabla, usando parser de tabla...")
        success = create_csv_from_table_pdf(pdf_path, output_csv)
    else:
        print("[INFO] Detectado formato de texto, usando parser de texto...")
        success = create_csv_from_pdf(pdf_path, output_csv)
    
    if success:
        print("\n" + "="*60)
        print("[OK] EXTRACCION COMPLETADA")
        print("="*60)
        print(f"\nAhora puedes usar el CSV: {output_csv}")
        print("   Este CSV tiene toda la informacion de empleados")
        print("   (nombre, zona, sucursal, puesto)")
        print("\nSiguiente paso:")
        print("   1. Asocia las fotos con los employee_id")
        print("   2. Ejecuta: python train_face_model_interactive.py")
    else:
        print("\n[ERROR] Error en la extraccion")

if __name__ == "__main__":
    main()

