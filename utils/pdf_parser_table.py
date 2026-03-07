"""
Parser específico para PDFs con formato de tabla (como PERSONAL TIENDAS BM.pdf).
Formato: | ZONA | SUCURSAL | PUESTO | NOMBRE | FOTO |
"""
import re
from pathlib import Path
from typing import List, Dict
import csv

def parse_table_pdf_text(pdf_text: str) -> List[Dict]:
    """
    Parsear el texto del PDF en formato de tabla.
    
    Args:
        pdf_text: Texto extraído del PDF
    
    Returns:
        Lista de diccionarios con información de empleados
    """
    employees = []
    employee_id = 1
    
    lines = pdf_text.split('\n')
    print(f"  Total lineas en texto: {len(lines)}")
    
    # Buscar la tabla (puede tener | o solo espacios)
    in_table = False
    header_found = False
    skip_next = False  # Para saltar la línea de separador después del header
    rows_processed = 0
    has_pipes = '|' in pdf_text  # Verificar si el texto tiene pipes
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Detectar inicio de tabla (con o sin pipes)
        # Buscar línea que contenga todas las columnas del header
        line_upper = line.upper()
        if ('ZONA' in line_upper and 'SUCURSAL' in line_upper and 
            'PUESTO' in line_upper and 'NOMBRE' in line_upper):
            in_table = True
            header_found = True
            skip_next = True  # La siguiente línea será el separador o datos
            print(f"  [DEBUG] Header de tabla detectado en linea {i}: {line[:60]}")
            continue
        
        # Detectar separador de tabla (---) - saltarlo
        if line.startswith('---') and in_table:
            if skip_next:
                skip_next = False
            continue
        
        # Si estamos en una tabla
        if in_table and not skip_next:
            # Verificar si es una fila de datos (no header, no vacía)
            if line and not ('ZONA' in line.upper() and 'SUCURSAL' in line.upper()):
                rows_processed += 1
                
                # Parsear fila de tabla
                if has_pipes:
                    # Formato con pipes: | ZONA | SUCURSAL | PUESTO | NOMBRE | FOTO |
                    parts = [p.strip() for p in line.split('|')]
                    parts = [p for p in parts if p]
                else:
                    # Formato sin pipes: CDMX TIENDAS SUPERVISOR ORTIZ ROCHA MARILU #VALUE!
                    # Dividir por espacios, pero agrupar el nombre completo
                    words = line.split()
                    if len(words) >= 4:
                        # Las primeras 3 palabras son: ZONA, SUCURSAL, PUESTO
                        # El resto hasta #VALUE! es el NOMBRE
                        parts = []
                        if len(words) >= 1:
                            parts.append(words[0])  # ZONA
                        if len(words) >= 2:
                            parts.append(words[1])  # SUCURSAL
                        if len(words) >= 3:
                            parts.append(words[2])  # PUESTO
                        # El nombre puede ser múltiples palabras
                        nombre_parts = []
                        for j in range(3, len(words)):
                            if words[j] == '#VALUE!' or words[j].startswith('#'):
                                break
                            nombre_parts.append(words[j])
                        if nombre_parts:
                            parts.append(' '.join(nombre_parts))  # NOMBRE completo
                    else:
                        parts = []
                
                # Debug: mostrar primeras filas procesadas
                if rows_processed <= 5:
                    print(f"    Fila {rows_processed}: {len(parts)} columnas - {line[:80]}")
                
                # Formato esperado: ZONA, SUCURSAL, PUESTO, NOMBRE
                if len(parts) >= 4:
                    zona = parts[0].strip()
                    sucursal = parts[1].strip() if len(parts) > 1 else ""
                    puesto = parts[2].strip() if len(parts) > 2 else ""
                    nombre = parts[3].strip() if len(parts) > 3 else ""
                    
                    # Limpiar valores
                    zona = re.sub(r'^#\s*', '', zona).strip()
                    sucursal = re.sub(r'^#\s*', '', sucursal).strip()
                    puesto = re.sub(r'^#\s*', '', puesto).strip()
                    nombre = re.sub(r'^#\s*', '', nombre).strip()
                    
                    # Validar que no sean valores vacíos o #VALUE!
                    # Aceptar nombres aunque estén truncados (pueden tener solo parte del nombre)
                    if (zona and puesto and nombre and 
                        nombre != '#VALUE!' and zona != '#VALUE!' and 
                        len(nombre) > 1 and nombre.upper() not in ['FOTO', 'NOMBRE']):
                        
                        # Limpiar nombre (puede tener caracteres especiales)
                        nombre = re.sub(r'#VALUE!', '', nombre).strip()
                        nombre = ' '.join(nombre.split())  # Limpiar espacios múltiples
                        
                        # Si el nombre está muy truncado, intentar obtener más información
                        # (aunque en el PDF puede estar cortado)
                        
                        employees.append({
                            'employee_id': employee_id,
                            'nombre': nombre,
                            'zona': zona,
                            'sucursal': sucursal if sucursal else zona,  # Si no hay sucursal, usar zona
                            'puesto': puesto
                        })
                        
                        print(f"    Empleado {employee_id}: {nombre} - {puesto} ({zona}, {sucursal})")
                        employee_id += 1
        
        # Detectar fin de tabla
        if in_table and not line and i > 0:
            # Verificar si la siguiente línea no es parte de otra tabla
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if '|' not in next_line:
                    in_table = False
                    header_found = False
                elif 'ZONA' in next_line.upper() and 'SUCURSAL' in next_line.upper():
                    # Nueva tabla
                    header_found = True
                    skip_next = True
    
    print(f"  Total filas procesadas: {rows_processed}")
    print(f"  Total empleados encontrados: {len(employees)}")
    return employees

def extract_from_table_pdf_file(pdf_path: Path) -> List[Dict]:
    """
    Extraer información de empleados de un archivo PDF en formato de tabla.
    
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
    
    # Método 2: pdfplumber (mejor para tablas)
    try:
        import pdfplumber
        methods.append(("pdfplumber", lambda: _extract_with_pdfplumber(pdf_path)))
    except ImportError:
        pass
    
    # Método 3: pymupdf (fitz)
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
                print(f"  Texto extraido: {len(text)} caracteres")
                
                # Mostrar primeras líneas para debug
                lines_preview = text.split('\n')[:15]
                print(f"  Primeras lineas extraidas:")
                for idx, line in enumerate(lines_preview):
                    if line.strip():
                        print(f"    {idx}: {line.strip()[:80]}")
                
                employees = parse_table_pdf_text(text)
                if employees:
                    print(f"  [OK] Parser encontro {len(employees)} empleados")
                    return employees
                else:
                    print(f"  [WARNING] Parser no encontro empleados con {method_name}")
        except Exception as e:
            print(f"  [WARNING] {method_name} fallo: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    print("[ERROR] Todos los metodos de extraccion fallaron o no se encontraron empleados")
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
    """Extraer texto con pdfplumber (mejor para tablas)."""
    import pdfplumber
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Intentar extraer tabla primero
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        if row:
                            text += " | ".join([str(cell) if cell else "" for cell in row]) + "\n"
            else:
                # Si no hay tablas, extraer texto normal
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

def create_csv_from_table_pdf(pdf_path: Path, output_csv_path: Path) -> bool:
    """
    Crear un CSV a partir del PDF en formato de tabla.
    
    Args:
        pdf_path: Ruta al PDF
        output_csv_path: Ruta donde guardar el CSV
    
    Returns:
        True si se creó exitosamente
    """
    print(f"Extrayendo informacion del PDF (formato tabla): {pdf_path.name}")
    employees = extract_from_table_pdf_file(pdf_path)
    
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
    
    # Mostrar primeros empleados como ejemplo
    print(f"\n   Primeros 5 empleados:")
    for emp in employees[:5]:
        print(f"     {emp['employee_id']}: {emp['nombre']} - {emp['puesto']} ({emp['zona']}, {emp['sucursal']})")
    
    return True

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    pdf_path = base_dir / "PERSONAL TIENDAS BM.pdf"
    output_csv = base_dir / "employees_from_pdf.csv"
    
    if not pdf_path.exists():
        print(f"❌ No se encontró el PDF: {pdf_path}")
    else:
        create_csv_from_table_pdf(pdf_path, output_csv)

