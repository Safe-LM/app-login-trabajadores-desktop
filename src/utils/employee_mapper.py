"""
Utilidades para mapear employee_id con datos del JSON/CSV y fotos.
Prioriza JSON sobre CSV para tener la información más completa.
"""
import csv
import json
from pathlib import Path
from typing import Dict, Optional

# Cargar datos del JSON/CSV
EMPLOYEE_DATA = {}

def load_employee_data_from_json(json_path: Path) -> Dict[int, Dict]:
    """Cargar datos de empleados desde JSON."""
    if not json_path.exists():
        return {}
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            employees_list = json.load(f)
        
        employee_data = {}
        for emp in employees_list:
            employee_id = emp.get('employee_id')
            if employee_id:
                nombre_completo = emp.get('nombre', '').strip()
                partes_nombre = nombre_completo.split(' ', 1)
                
                employee_data[employee_id] = {
                    'employee_id': employee_id,
                    'zona': emp.get('zona', '').strip(),
                    'sucursal': emp.get('sucursal', '').strip(),
                    'puesto': emp.get('puesto', '').strip(),
                    'nombre_completo': nombre_completo,
                    'nombre': partes_nombre[0] if len(partes_nombre) > 0 else nombre_completo,
                    'apellido': partes_nombre[1] if len(partes_nombre) > 1 else '',
                    'photo_file': emp.get('photo_file', '')
                }
        
        return employee_data
    except Exception as e:
        print(f"[WARNING] Error cargando JSON: {e}")
        return {}

def load_employee_data():
    """Cargar datos de empleados (prioriza JSON, fallback a CSV)."""
    global EMPLOYEE_DATA
    
    if EMPLOYEE_DATA:
        return EMPLOYEE_DATA
    
    base_dir = Path(__file__).parent.parent
    
    # PRIORIDAD 1: Buscar JSON (tiene 56 empleados) en data/photos/
    json_path = base_dir / "data" / "photos" / "json" / "employees_db.json"
    if json_path.exists():
        EMPLOYEE_DATA = load_employee_data_from_json(json_path)
        if EMPLOYEE_DATA:
            print(f"[OK] Cargados {len(EMPLOYEE_DATA)} empleados del JSON")
            return EMPLOYEE_DATA
    
    # PRIORIDAD 2: Buscar CSV (fallback)
    posibles_csvs = [
        base_dir / "employees_from_pdf.csv",  # CSV generado del PDF
        base_dir.parent / "Copia de employees_simple.csv",  # CSV original
        base_dir / "employees_simple.csv",  # CSV alternativo
    ]
    
    csv_path = None
    for path in posibles_csvs:
        if path.exists():
            csv_path = path
            break
    
    if csv_path is None:
        print(f"[WARNING] No se encontró ningún archivo JSON ni CSV. Buscando en:")
        print(f"  JSON: {json_path}")
        for path in posibles_csvs:
            print(f"  CSV: {path}")
        return {}
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                employee_id = int(row.get('employee_id', 0))
                if employee_id > 0:
                    # Separar nombre completo en nombre y apellido
                    nombre_completo = row.get('nombre', '').strip()
                    partes_nombre = nombre_completo.split(' ', 1)
                    
                    EMPLOYEE_DATA[employee_id] = {
                        'employee_id': employee_id,
                        'zona': row.get('zona', '').strip(),
                        'sucursal': row.get('sucursal', '').strip(),
                        'puesto': row.get('puesto', '').strip(),
                        'nombre_completo': nombre_completo,
                        'nombre': partes_nombre[0] if len(partes_nombre) > 0 else nombre_completo,
                        'apellido': partes_nombre[1] if len(partes_nombre) > 1 else '',
                    }
        
        print(f"[OK] Cargados {len(EMPLOYEE_DATA)} empleados del CSV")
        return EMPLOYEE_DATA
    except Exception as e:
        print(f"[ERROR] Error cargando CSV: {e}")
        return {}

def get_employee_by_id(employee_id: int) -> Optional[Dict]:
    """Obtener datos de empleado por employee_id."""
    if not EMPLOYEE_DATA:
        load_employee_data()
    return EMPLOYEE_DATA.get(employee_id)

def get_photo_path(employee_id: int) -> Optional[Path]:
    """Obtener ruta de la foto de un empleado."""
    # Ajustar para la nueva estructura profesional
    PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
    database_fotos_dir = PROJECT_ROOT / "data" / "photos"
    
    # PRIORIDAD 1: Buscar en el JSON si tiene photo_file
    if EMPLOYEE_DATA and employee_id in EMPLOYEE_DATA:
        photo_file = EMPLOYEE_DATA[employee_id].get('photo_file', '')
        if photo_file:
            # El photo_file puede ser "photos/photo_0001_p1.jpeg" o solo "photo_0001_p1.jpeg"
            photo_name = Path(photo_file).name
            photos_dir = database_fotos_dir / "photos"
            photo_path = photos_dir / photo_name
            if photo_path.exists():
                return photo_path
    
    # PRIORIDAD 2: Buscar en database_fotos/photos/ con formato photo_XXXX_pX.jpeg
    photos_dir = database_fotos_dir / "photos"
    if photos_dir.exists():
        # Buscar foto con formato photo_0001_p1.jpeg (employee_id = 1)
        import re
        for foto_file in list(photos_dir.glob("*.jpeg")) + list(photos_dir.glob("*.jpg")) + list(photos_dir.glob("*.png")):
            match = re.search(r'photo_(\d+)', foto_file.stem)
            if match and int(match.group(1)) == employee_id:
                return foto_file
    
    # PRIORIDAD 3: Buscar foto por employee_id en database_fotos/ directamente
    posibles_nombres = [
        f"photo_{employee_id}.jpg",
        f"photo_{employee_id}.jpeg",
        f"photo_{employee_id}.png",
        f"trabajador_{employee_id}.jpg",
        f"trabajador_{employee_id}.jpeg",
        f"trabajador_{employee_id}.png",
    ]
    
    for nombre in posibles_nombres:
        foto_path = database_fotos_dir / nombre
        if foto_path.exists():
            return foto_path
    
    return None

# Cargar datos al importar
load_employee_data()

