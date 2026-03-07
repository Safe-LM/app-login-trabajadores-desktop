"""
Script para entrenar el sistema de reconocimiento facial ligero.
Usa face_recognition library (más ligero, no requiere PyTorch).
"""
from pathlib import Path
import cv2
import json
import pickle
from typing import List, Dict
import numpy as np

def check_face_recognition():
    """Verificar si face_recognition está instalada."""
    try:
        import face_recognition
        return True, face_recognition
    except ImportError:
        print("❌ face_recognition library no está instalada")
        print("📦 Instálala con: pip install face-recognition")
        return False, None

def load_employee_data(json_path: Path) -> Dict[int, Dict]:
    """Cargar datos de empleados desde JSON."""
    if not json_path.exists():
        print(f"❌ No se encontró el archivo JSON: {json_path}")
        return {}
    
    with open(json_path, 'r', encoding='utf-8') as f:
        employees_data = json.load(f)
    
    employee_dict = {}
    for emp in employees_data:
        employee_dict[emp['employee_id']] = emp
    
    print(f"✅ Cargados {len(employee_dict)} empleados del JSON")
    return employee_dict

def extract_face_encoding(image_path: Path, face_recognition) -> List:
    """Extraer encoding facial de una imagen."""
    try:
        # Cargar imagen
        image = face_recognition.load_image_file(str(image_path))
        
        # Detectar caras
        face_locations = face_recognition.face_locations(image, model='hog')
        
        if len(face_locations) == 0:
            print(f"⚠️ No se detectó cara en: {image_path.name}")
            return []
        
        # Obtener encodings
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        if len(face_encodings) == 0:
            print(f"⚠️ No se pudo extraer encoding de: {image_path.name}")
            return []
        
        # Retornar el primer encoding (la cara más grande)
        return face_encodings
        
    except Exception as e:
        print(f"❌ Error procesando {image_path.name}: {e}")
        return []

def main():
    """Función principal."""
    print("="*60)
    print("ENTRENAMIENTO DE RECONOCIMIENTO FACIAL LIGERO")
    print("="*60)
    print()
    
    # Verificar face_recognition
    available, face_recognition = check_face_recognition()
    if not available:
        return
    
    # Rutas
    base_dir = Path(__file__).parent
    database_fotos_dir = base_dir / "database_fotos"
    photos_dir = database_fotos_dir / "photos"
    json_path = database_fotos_dir / "json" / "employees_db.json"
    output_file = database_fotos_dir / "face_encodings.pkl"
    
    # Verificar directorios
    if not photos_dir.exists():
        print(f"❌ No se encontró el directorio de fotos: {photos_dir}")
        return
    
    # Cargar datos de empleados
    employee_data = load_employee_data(json_path)
    
    if not employee_data:
        print("⚠️ No hay datos de empleados. El sistema funcionará pero sin información adicional.")
    
    # Procesar fotos
    print()
    print("📸 Procesando fotos...")
    print()
    
    encodings: List = []
    employee_ids: List[int] = []
    processed = 0
    failed = 0
    
    # Obtener todas las imágenes
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
    image_files = [f for f in photos_dir.iterdir() 
                   if f.suffix.lower() in image_extensions]
    
    print(f"📁 Encontradas {len(image_files)} imágenes")
    print()
    
    for image_file in image_files:
        # Intentar obtener employee_id del nombre del archivo
        # Formato esperado: photo_XXXX_pY.jpg o photo_XXXX.jpg
        employee_id = None
        
        # Buscar en el nombre del archivo
        parts = image_file.stem.split('_')
        if len(parts) >= 2:
            try:
                # Intentar extraer ID del nombre (ej: photo_0001 -> 1)
                potential_id = parts[1]
                if potential_id.isdigit():
                    employee_id = int(potential_id)
            except:
                pass
        
        # Si no se encontró en el nombre, buscar en employee_data por nombre de archivo
        if employee_id is None:
            for emp_id, emp_info in employee_data.items():
                if emp_info.get('photo_file') == image_file.name:
                    employee_id = emp_id
                    break
        
        # Si aún no se encontró, usar el índice
        if employee_id is None:
            employee_id = processed + 1
        
        # Extraer encoding
        face_encodings = extract_face_encoding(image_file, face_recognition)
        
        if face_encodings:
            # Usar el primer encoding (cara más grande)
            encodings.append(face_encodings[0])
            employee_ids.append(employee_id)
            processed += 1
            print(f"✅ [{processed}] {image_file.name} -> Empleado {employee_id}")
        else:
            failed += 1
            print(f"❌ [{failed} fallidas] {image_file.name}")
    
    print()
    print("="*60)
    print(f"📊 Resumen:")
    print(f"   ✅ Procesadas exitosamente: {processed}")
    print(f"   ❌ Fallidas: {failed}")
    print("="*60)
    print()
    
    if len(encodings) == 0:
        print("❌ No se pudieron extraer encodings. Verifica las fotos.")
        return
    
    # Guardar encodings
    print("💾 Guardando encodings...")
    data = {
        'encodings': encodings,
        'employee_ids': employee_ids
    }
    
    with open(output_file, 'wb') as f:
        pickle.dump(data, f)
    
    print(f"✅ Encodings guardados en: {output_file}")
    print()
    print("🎉 ¡Entrenamiento completado!")
    print()
    print("📝 Próximos pasos:")
    print("   1. Ejecuta: python main.py")
    print("   2. El sistema usará automáticamente el reconocimiento ligero")

if __name__ == "__main__":
    main()

