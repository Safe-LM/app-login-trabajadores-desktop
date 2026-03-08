"""
Script mejorado para extraer fotos del PDF "PERSONAL TIENDAS BM.pdf" 
y asociarlas correctamente con la información del CSV.
"""
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import io
import csv
from typing import List, Tuple, Dict

def extract_images_from_pdf_pymupdf(pdf_path: Path) -> List[Tuple]:
    """Extraer imágenes usando PyMuPDF (más robusto)."""
    images = []
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        print(f"  PDF tiene {len(doc)} paginas")
        
        total_images_found = 0
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Método 1: get_images() - imágenes incrustadas
            image_list = page.get_images()
            print(f"  Pagina {page_num + 1}: {len(image_list)} imagenes encontradas (get_images)")
            
            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Filtrar imágenes muy pequeñas (probablemente iconos/logos)
                    width = base_image.get("width", 0)
                    height = base_image.get("height", 0)
                    
                    # Solo incluir imágenes que parecen ser fotos de personas (más grandes)
                    if width > 50 and height > 50:
                        # Convertir a PIL Image
                        img_pil = Image.open(io.BytesIO(image_bytes))
                        images.append((page_num, img_pil, width, height))
                        total_images_found += 1
                        print(f"    [OK] Imagen {total_images_found}: {width}x{height} (pagina {page_num+1}, xref={xref})")
                    else:
                        print(f"    [SKIP] Imagen muy pequena: {width}x{height}")
                        
                except Exception as e:
                    print(f"    [WARNING] Error extrayendo imagen {img_index} de pagina {page_num+1}: {e}")
                    continue
            
            # Método 2: Buscar imágenes en XObjects (método alternativo)
            try:
                xref_list = page.get_contents()
                if xref_list:
                    for xref in xref_list:
                        try:
                            xobject = doc.xref_get_key(xref, "/Subtype")
                            if xobject and xobject[1] == "/Image":
                                base_image = doc.extract_image(xref)
                                if base_image:
                                    image_bytes = base_image["image"]
                                    width = base_image.get("width", 0)
                                    height = base_image.get("height", 0)
                                    
                                    if width > 50 and height > 50:
                                        img_pil = Image.open(io.BytesIO(image_bytes))
                                        # Verificar que no sea duplicada
                                        is_duplicate = False
                                        for existing in images:
                                            if existing[0] == page_num and existing[2] == width and existing[3] == height:
                                                is_duplicate = True
                                                break
                                        
                                        if not is_duplicate:
                                            images.append((page_num, img_pil, width, height))
                                            total_images_found += 1
                                            print(f"    [OK] Imagen {total_images_found} (XObject): {width}x{height} (pagina {page_num+1})")
                        except Exception:
                            pass
            except Exception as e:
                print(f"    [INFO] No se pudieron extraer XObjects de pagina {page_num+1}: {e}")
        
        doc.close()
        print(f"\n  [OK] Total imagenes extraidas: {total_images_found}")
        
    except ImportError:
        print("  [ERROR] PyMuPDF no instalado. Instalando...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyMuPDF"])
        import fitz
        return extract_images_from_pdf_pymupdf(pdf_path)
    except Exception as e:
        print(f"  [ERROR] Error con PyMuPDF: {e}")
        import traceback
        traceback.print_exc()
    
    return images

def filter_face_images(images: List[Tuple]) -> List[Tuple]:
    """Filtrar imágenes que parecen ser caras de personas usando YOLO."""
    face_images = []
    
    print("\nFiltrando imagenes de caras con YOLO...")
    
    # Cargar YOLO para detectar personas
    try:
        from ultralytics import YOLO
        base_dir = Path(__file__).parent
        yolo_path = base_dir / 'yolo11s.pt'
        
        if not yolo_path.exists():
            print("  [WARNING] Modelo YOLO no encontrado, descargando...")
            yolo_model = YOLO('yolo11s.pt')  # Descargará automáticamente
        else:
            yolo_model = YOLO(str(yolo_path))
            
    except Exception as e:
        print(f"  [WARNING] YOLO no disponible: {e}")
        print("  Guardando todas las imagenes sin filtrar...")
        return images
    
    for idx, img_data in enumerate(images):
        try:
            page_num = img_data[0]
            img_pil = img_data[1]
            
            # Convertir PIL a OpenCV
            img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
            
            # Detectar personas
            results = yolo_model(img_cv, classes=[0], verbose=False)
            
            has_person = False
            confidence = 0.0
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    conf = float(box.conf)
                    if conf > confidence:
                        confidence = conf
                    if conf > 0.3:  # Umbral bajo para detectar personas
                        has_person = True
            
            if has_person:
                face_images.append(img_data)
                print(f"  [OK] Imagen {idx+1}: Contiene persona (confianza: {confidence:.2f}, pagina {page_num+1})")
            else:
                print(f"  [SKIP] Imagen {idx+1}: No contiene persona (pagina {page_num+1})")
                
        except Exception as e:
            print(f"  [WARNING] Error procesando imagen {idx+1}: {e}")
            # En caso de error, incluir la imagen por si acaso
            face_images.append(img_data)
    
    print(f"\n[OK] {len(face_images)} imagenes de caras encontradas de {len(images)} totales")
    return face_images

def load_employees_from_csv(csv_path: Path) -> List[Dict]:
    """Cargar información de empleados del CSV."""
    employees = []
    
    if not csv_path.exists():
        print(f"[WARNING] CSV no encontrado: {csv_path}")
        return employees
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                employees.append({
                    'employee_id': int(row.get('employee_id', 0)),
                    'nombre': row.get('nombre', '').strip(),
                    'zona': row.get('zona', '').strip(),
                    'sucursal': row.get('sucursal', '').strip(),
                    'puesto': row.get('puesto', '').strip()
                })
        
        print(f"[OK] Cargados {len(employees)} empleados del CSV")
    except Exception as e:
        print(f"[ERROR] Error cargando CSV: {e}")
        import traceback
        traceback.print_exc()
    
    return employees

def extract_employees_from_pdf(pdf_path: Path) -> bool:
    """Extraer información de empleados del PDF y crear CSV si no existe."""
    from utils.pdf_parser import create_csv_from_pdf
    
    base_dir = Path(__file__).parent
    csv_path = base_dir / "employees_from_pdf.csv"
    
    # Si el CSV ya existe, no regenerarlo
    if csv_path.exists():
        print(f"[INFO] CSV ya existe: {csv_path}")
        return True
    
    print(f"[INFO] Extrayendo informacion de empleados del PDF...")
    return create_csv_from_pdf(pdf_path, csv_path)

def save_images_to_database(images: List[Tuple], output_dir: Path, employees: List[Dict]):
    """Guardar imágenes en database_fotos y asociarlas con empleados."""
    output_dir.mkdir(exist_ok=True)
    
    print(f"\nGuardando imagenes en {output_dir}...")
    print(f"Total empleados en CSV: {len(employees)}")
    print(f"Total imagenes extraidas: {len(images)}")
    
    if len(images) == 0:
        print("[ERROR] No hay imagenes para guardar")
        return
    
    if len(employees) == 0:
        print("[WARNING] No hay empleados en el CSV, guardando con IDs secuenciales")
    
    # Verificar que la cantidad coincida
    if len(images) != len(employees):
        print(f"\n[WARNING] La cantidad de imagenes ({len(images)}) no coincide con la cantidad de empleados ({len(employees)})")
        if len(images) < len(employees):
            print(f"  [INFO] Faltan {len(employees) - len(images)} fotos. Se guardaran las disponibles.")
        else:
            print(f"  [INFO] Hay {len(images) - len(employees)} fotos extras. Se guardaran las primeras {len(employees)}.")
    
    saved_count = 0
    skipped_count = 0
    
    # Guardar cada imagen asociándola con el empleado correspondiente
    max_employees = min(len(images), len(employees)) if employees else len(images)
    
    for idx in range(max_employees):
        try:
            img_data = images[idx]
            page_num = img_data[0]
            img_pil = img_data[1]
            
            # Obtener información del empleado correspondiente
            if idx < len(employees):
                employee_id = employees[idx]['employee_id']
                nombre = employees[idx]['nombre']
                zona = employees[idx]['zona']
                sucursal = employees[idx]['sucursal']
                puesto = employees[idx]['puesto']
            else:
                # Si hay más imágenes que empleados, usar índice + 1
                employee_id = idx + 1
                nombre = f"Empleado {employee_id}"
                zona = "N/A"
                sucursal = "N/A"
                puesto = "N/A"
            
            # Guardar como JPG
            output_path = output_dir / f"photo_{employee_id}.jpg"
            
            # Si el archivo ya existe, preguntar o sobrescribir
            if output_path.exists():
                print(f"  [WARNING] {output_path.name} ya existe, sobrescribiendo...")
            
            # Convertir a RGB si es necesario
            if img_pil.mode != 'RGB':
                img_pil = img_pil.convert('RGB')
            
            # Redimensionar si es muy grande (optimizar)
            max_size = 800
            if img_pil.width > max_size or img_pil.height > max_size:
                img_pil.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Guardar imagen
            img_pil.save(output_path, 'JPEG', quality=95)
            
            print(f"  [OK] Guardada: {output_path.name} -> {nombre} ({zona}, {sucursal}, {puesto})")
            saved_count += 1
            
        except Exception as e:
            print(f"  [ERROR] Error guardando imagen {idx+1}: {e}")
            skipped_count += 1
            continue
    
    print(f"\n[OK] {saved_count} imagenes guardadas exitosamente")
    if skipped_count > 0:
        print(f"[WARNING] {skipped_count} imagenes no se pudieron guardar")
    
    # Mostrar resumen de asociaciones
    if employees:
        print(f"\nResumen de asociaciones (primeras 10):")
        for idx in range(min(10, len(images), len(employees))):
            emp = employees[idx]
            print(f"  photo_{emp['employee_id']}.jpg -> {emp['nombre']} ({emp['zona']}, {emp['sucursal']})")
        
        if len(images) > 10:
            print(f"  ... y {len(images) - 10} mas")

def main():
    """Función principal."""
    print("="*70)
    print("EXTRACCION DE FOTOS DEL PDF 'PERSONAL TIENDAS BM.pdf'")
    print("="*70)
    print()
    
    base_dir = Path(__file__).parent
    
    # Buscar el PDF correcto (priorizar PERSONAL TIENDAS BM.pdf que tiene formato tabla)
    pdf_path = base_dir / "PERSONAL TIENDAS BM.pdf"
    if not pdf_path.exists():
        pdf_path = base_dir / "plantilla_personal_por_zona_sucursal.pdf"
    
    output_dir = base_dir / "database_fotos"
    employees_csv = base_dir / "employees_from_pdf.csv"
    
    # Verificar que el PDF existe
    if not pdf_path.exists():
        print(f"[ERROR] No se encontro el PDF")
        print(f"  Buscando PDFs alternativos...")
        pdf_files = list(base_dir.glob("*.pdf"))
        if pdf_files:
            print(f"  PDFs encontrados:")
            for pdf in pdf_files:
                print(f"    - {pdf.name}")
        return
    
    print(f"[OK] PDF encontrado: {pdf_path.name}")
    
    # Paso 1: Extraer información de empleados del PDF si no existe el CSV
    if not employees_csv.exists():
        print("\n[PASO 1] Extrayendo informacion de empleados del PDF...")
        # Detectar formato del PDF
        if "PERSONAL TIENDAS BM" in pdf_path.name or "BM" in pdf_path.name:
            from utils.pdf_parser_table import create_csv_from_table_pdf
            if not create_csv_from_table_pdf(pdf_path, employees_csv):
                print("[ERROR] No se pudo extraer informacion del PDF")
                return
        else:
            from utils.pdf_parser import create_csv_from_pdf
            if not create_csv_from_pdf(pdf_path, employees_csv):
                print("[ERROR] No se pudo extraer informacion del PDF")
                return
    else:
        print(f"[OK] CSV de empleados encontrado: {employees_csv.name}")
    
    # Paso 2: Cargar información de empleados
    employees = load_employees_from_csv(employees_csv)
    
    if not employees:
        print("[ERROR] No se pudieron cargar empleados del CSV")
        print("  Ejecuta primero: python extract_employees_from_pdf.py")
        return
    
    # Paso 3: Extraer imágenes del PDF
    print("\n[PASO 2] Extrayendo imagenes del PDF...")
    images = extract_images_from_pdf_pymupdf(pdf_path)
    
    if not images:
        print("[ERROR] No se pudieron extraer imagenes del PDF")
        return
    
    # Paso 4: Filtrar imágenes de caras
    print("\n[PASO 3] Filtrando imagenes de caras...")
    face_images = filter_face_images(images)
    
    if not face_images:
        print("[WARNING] No se encontraron imagenes de caras")
        print("  Guardando todas las imagenes de todas formas...")
        face_images = images
    
    # Verificar que tenemos suficientes imágenes
    if len(face_images) < len(employees):
        print(f"[WARNING] Solo se encontraron {len(face_images)} imagenes para {len(employees)} empleados")
        print("  Algunos empleados no tendran foto")
    elif len(face_images) > len(employees):
        print(f"[INFO] Se encontraron {len(face_images)} imagenes para {len(employees)} empleados")
        print("  Se guardaran las primeras {len(employees)} imagenes")
    
    # Paso 5: Guardar imágenes
    print("\n[PASO 4] Guardando imagenes en database_fotos...")
    save_images_to_database(face_images, output_dir, employees)
    
    print("\n" + "="*70)
    print("[OK] EXTRACCION DE FOTOS COMPLETADA")
    print("="*70)
    print(f"\nLas fotos estan en: {output_dir}")
    print(f"Total fotos guardadas: {len(face_images)}")
    print(f"Total empleados en CSV: {len(employees)}")
    print("\nSiguiente paso:")
    print("  python train_face_model_auto.py")

if __name__ == "__main__":
    main()

