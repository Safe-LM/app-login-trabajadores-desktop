"""
Parser para extraer información de empleados del PDF.
Convierte el PDF en un CSV que el sistema puede usar.
"""
import re
from pathlib import Path
from typing import List, Dict
import csv

def parse_pdf_text(pdf_text: str) -> List[Dict]:
    """
    Parsear el texto del PDF y extraer información de empleados.
    
    Args:
        pdf_text: Texto extraído del PDF
    
    Returns:
        Lista de diccionarios con información de empleados
    """
    employees = []
    
    # Patrones para detectar zonas y sucursales (más flexibles)
    zona_patterns = [
        r'#\s*Zona:\s*([^|]+)\s*\|\s*Sucursal:\s*([^\n]+)',  # # Zona: CDMX | Sucursal: TIENDAS
        r'Zona:\s*([^|]+)\s*\|\s*Sucursal:\s*([^\n]+)',  # Zona: CDMX | Sucursal: TIENDAS
        r'Zona\s+([^|]+)\s+Sucursal\s+([^\n]+)',  # Zona CDMX Sucursal TIENDAS
    ]
    
    current_zona = None
    current_sucursal = None
    employee_id = 1
    
    lines = pdf_text.split('\n')
    i = 0
    
    # Debug: guardar primeras líneas para ver qué se extrajo
    if len(employees) == 0 and len(lines) > 0:
        print(f"  Primeras lineas extraidas del PDF:")
        for idx, line in enumerate(lines[:20]):
            if line.strip():
                print(f"     {idx}: {line.strip()[:80]}")
    
    puestos = ['ENCARGADA', 'ASESORA', 'SUPERVISOR', 'GERENTE', 'SUPERVISORA', 'ENCARGADO', 'SUPERVISORA']
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Detectar zona y sucursal con múltiples patrones
        zona_match = None
        for pattern in zona_patterns:
            zona_match = re.search(pattern, line, re.IGNORECASE)
            if zona_match:
                break
        
        if zona_match:
            current_zona = zona_match.group(1).strip()
            current_sucursal = zona_match.group(2).strip()
            # Limpiar zona y sucursal
            current_zona = re.sub(r'^#\s*', '', current_zona).strip()
            current_sucursal = current_sucursal.strip()
            print(f"  Zona detectada: {current_zona} | Sucursal: {current_sucursal}")
            i += 1
            continue
        
        # Detectar separador
        if line.startswith('---') or line == '':
            i += 1
            continue
        
        # Detectar empleado (solo si tenemos zona y sucursal)
        if line and current_zona and current_sucursal and not line.startswith('#'):
            nombre_parts = []
            puesto = None
            
            # Leer líneas hasta encontrar el puesto o un separador
            j = i
            max_lines = 6  # Aumentar para capturar nombres largos
            
            while j < len(lines) and j < i + max_lines:
                current_line = lines[j].strip()
                
                # Si encontramos una nueva zona, parar
                if current_line.startswith('#') and 'Zona:' in current_line:
                    break
                
                # Si encontramos un separador, parar
                if current_line.startswith('---'):
                    break
                
                # Si la línea está vacía, continuar
                if not current_line:
                    j += 1
                    continue
                
                # Verificar si es un puesto
                current_upper = current_line.upper()
                found_puesto = None
                
                # Buscar puesto exacto (palabra completa)
                for p in puestos:
                    # Buscar el puesto como palabra completa
                    if re.search(r'\b' + re.escape(p) + r'\b', current_upper):
                        found_puesto = p
                        puesto = p
                        break
                
                if found_puesto:
                    # El nombre está en las líneas anteriores (desde i hasta j-1)
                    for k in range(i, j):
                        name_line = lines[k].strip()
                        if name_line and name_line.upper() not in puestos:
                            # Verificar que no sea zona/sucursal
                            if not re.search(r'Zona:|Sucursal:', name_line, re.IGNORECASE):
                                nombre_parts.append(name_line)
                    break
                else:
                    # Es parte del nombre (solo si no es muy corta y no parece ser otro campo)
                    if len(current_line) > 2 and not re.search(r'Zona:|Sucursal:', current_line, re.IGNORECASE):
                        nombre_parts.append(current_line)
                
                j += 1
            
            # Si encontramos nombre y puesto, agregar empleado
            if nombre_parts and puesto:
                nombre_completo = ' '.join(nombre_parts).strip()
                nombre_completo = ' '.join(nombre_completo.split())  # Limpiar espacios múltiples
                
                # Validar que el nombre no sea solo el puesto y tenga al menos 3 caracteres
                if nombre_completo.upper() not in puestos and len(nombre_completo) > 3:
                    employees.append({
                        'employee_id': employee_id,
                        'nombre': nombre_completo,
                        'zona': current_zona,
                        'sucursal': current_sucursal,
                        'puesto': puesto
                    })
                    
                    print(f"    Empleado {employee_id}: {nombre_completo} - {puesto}")
                    employee_id += 1
                    i = j  # Continuar desde donde encontramos el puesto
                    continue
        
        i += 1
    
    return employees

def extract_from_pdf_file(pdf_path: Path) -> List[Dict]:
    """
    Extraer información de empleados de un archivo PDF.
    
    Args:
        pdf_path: Ruta al archivo PDF
    
    Returns:
        Lista de diccionarios con información de empleados
    """
    text = ""
    
    # Intentar múltiples métodos de extracción
    methods = []
    
    # Método 1: PyPDF2
    try:
        import PyPDF2
        methods.append(("PyPDF2", lambda: _extract_with_pypdf2(pdf_path)))
    except ImportError:
        pass
    
    # Método 2: pdfplumber (más robusto)
    try:
        import pdfplumber
        methods.append(("pdfplumber", lambda: _extract_with_pdfplumber(pdf_path)))
    except ImportError:
        pass
    
    # Método 3: pymupdf (fitz) - muy robusto
    try:
        import fitz  # PyMuPDF
        methods.append(("PyMuPDF", lambda: _extract_with_pymupdf(pdf_path)))
    except ImportError:
        pass
    
    if not methods:
        print("⚠️ No hay bibliotecas de PDF instaladas. Instalando pdfplumber...")
        import subprocess
        import sys
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber"])
        import pdfplumber
        methods.append(("pdfplumber", lambda: _extract_with_pdfplumber(pdf_path)))
    
    # Probar cada método hasta que uno funcione
    for method_name, method_func in methods:
        try:
            print(f"  Intentando con {method_name}...")
            text = method_func()
            if text and len(text) > 100:  # Verificar que se extrajo suficiente texto
                print(f"  [OK] Extraccion exitosa con {method_name}")
                return parse_pdf_text(text)
        except Exception as e:
            print(f"  [WARNING] {method_name} fallo: {e}")
            continue
    
    print("[ERROR] Todos los metodos de extraccion fallaron")
    return []

def _extract_with_pypdf2(pdf_path: Path) -> str:
    """Extraer texto con PyPDF2."""
    import PyPDF2
    text = ""
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
    return text

def _extract_with_pdfplumber(pdf_path: Path) -> str:
    """Extraer texto con pdfplumber."""
    import pdfplumber
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def _extract_with_pymupdf(pdf_path: Path) -> str:
    """Extraer texto con PyMuPDF."""
    import fitz
    text = ""
    doc = fitz.open(pdf_path)
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text

def create_csv_from_pdf(pdf_path: Path, output_csv_path: Path) -> bool:
    """
    Crear un CSV a partir del PDF con información de empleados.
    
    Args:
        pdf_path: Ruta al PDF
        output_csv_path: Ruta donde guardar el CSV
    
    Returns:
        True si se creó exitosamente
    """
    print(f"Extrayendo informacion del PDF: {pdf_path.name}")
    employees = extract_from_pdf_file(pdf_path)
    
    if not employees:
        print("[ERROR] No se pudieron extraer empleados del PDF")
        return False
    
    print(f"[OK] Extraidos {len(employees)} empleados")
    
    # Guardar en CSV
    with open(output_csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['employee_id', 'nombre', 'zona', 'sucursal', 'puesto']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for emp in employees:
            writer.writerow(emp)
    
    print(f"[OK] CSV guardado en: {output_csv_path}")
    print(f"\nResumen:")
    print(f"   Total empleados: {len(employees)}")
    
    # Estadísticas por zona
    zonas = {}
    for emp in employees:
        zona = emp['zona']
        if zona not in zonas:
            zonas[zona] = 0
        zonas[zona] += 1
    
    print(f"\n   Por zona:")
    for zona, count in sorted(zonas.items()):
        print(f"     {zona}: {count} empleados")
    
    return True

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    pdf_path = base_dir / "plantilla_personal_por_zona_sucursal.pdf"
    output_csv = base_dir / "employees_from_pdf.csv"
    
    if not pdf_path.exists():
        print(f"❌ No se encontró el PDF: {pdf_path}")
    else:
        create_csv_from_pdf(pdf_path, output_csv)

