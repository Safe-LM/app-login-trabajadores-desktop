"""
Script para extraer fotos de empleados del PDF y guardarlas en database_fotos.
"""
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import io

def extract_images_from_pdf_pypdf2(pdf_path: Path) -> list:
    """Extraer imágenes usando PyPDF2."""
    images = []
    try:
        import PyPDF2
        
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            for page_num, page in enumerate(pdf_reader.pages):
                if '/XObject' in page['/Resources']:
                    xObject = page['/Resources']['/XObject'].get_object()
                    
                    for obj in xObject:
                        if xObject[obj]['/Subtype'] == '/Image':
                            try:
                                size = (xObject[obj]['/Width'], xObject[obj]['/Height'])
                                data = xObject[obj].get_data()
                                
                                # Intentar diferentes formatos
                                if xObject[obj]['/ColorSpace'] == '/DeviceRGB':
                                    mode = "RGB"
                                else:
                                    mode = "P"
                                
                                if '/Filter' in xObject[obj]:
                                    filter_type = xObject[obj]['/Filter']
                                    if filter_type == '/DCTDecode':
                                        # JPEG
                                        img = Image.open(io.BytesIO(data))
                                        images.append((page_num, img))
                                    elif filter_type == '/FlateDecode':
                                        # PNG
                                        img = Image.open(io.BytesIO(data))
                                        images.append((page_num, img))
                                    else:
                                        # Otros formatos
                                        try:
                                            img = Image.open(io.BytesIO(data))
                                            images.append((page_num, img))
                                        except Exception:
                                            pass
                            except Exception as e:
                                print(f"  [WARNING] Error extrayendo imagen de pagina {page_num}: {e}")
                                continue
    except Exception as e:
        print(f"  [ERROR] Error con PyPDF2: {e}")
    
    return images

def extract_images_from_pdf_pymupdf(pdf_path: Path) -> list:
    """Extraer imágenes usando PyMuPDF (más robusto)."""
    images = []
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images()
            
            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Convertir a PIL Image
                    img_pil = Image.open(io.BytesIO(image_bytes))
                    images.append((page_num, img_pil))
                except Exception as e:
                    print(f"  [WARNING] Error extrayendo imagen {img_index} de pagina {page_num}: {e}")
                    continue
        
        doc.close()
    except ImportError:
        print("  [INFO] PyMuPDF no instalado, usando PyPDF2")
    except Exception as e:
        print(f"  [ERROR] Error con PyMuPDF: {e}")
    
    return images

def extract_images_from_pdf(pdf_path: Path) -> list:
    """Extraer todas las imágenes del PDF usando el mejor método disponible."""
    print("Extrayendo imagenes del PDF...")
    
    # Intentar PyMuPDF primero (mejor)
    images = extract_images_from_pdf_pymupdf(pdf_path)
    
    # Si no funcionó, intentar PyPDF2
    if not images:
        print("  Intentando con PyPDF2...")
        images = extract_images_from_pdf_pypdf2(pdf_path)
    
    print(f"  [OK] Extraidas {len(images)} imagenes del PDF")
    return images

def filter_face_images(images: list) -> list:
    """Filtrar imágenes que parecen ser caras de personas."""
    face_images = []
    
    print("\nFiltrando imagenes de caras...")
    
    # Cargar YOLO para detectar personas
    try:
        from ultralytics import YOLO
        base_dir = Path(__file__).parent
        yolo_model = YOLO(str(base_dir / 'yolo11s.pt'))
    except Exception:
        print("  [WARNING] YOLO no disponible, guardando todas las imagenes")
        return images
    
    for idx, (page_num, img_pil) in enumerate(images):
        try:
            # Convertir PIL a OpenCV
            img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
            
            # Detectar personas
            results = yolo_model(img_cv, classes=[0], verbose=False)
            
            has_person = False
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    conf = float(box.conf)
                    if conf > 0.3:  # Umbral bajo para detectar personas
                        has_person = True
                        break
                if has_person:
                    break
            
            if has_person:
                face_images.append((page_num, img_pil))
                print(f"  [OK] Imagen {idx+1}: Contiene persona (pagina {page_num+1})")
            else:
                print(f"  [SKIP] Imagen {idx+1}: No contiene persona (pagina {page_num+1})")
                
        except Exception as e:
            print(f"  [WARNING] Error procesando imagen {idx+1}: {e}")
            # En caso de error, incluir la imagen por si acaso
            face_images.append((page_num, img_pil))
    
    print(f"\n[OK] {len(face_images)} imagenes de caras encontradas")
    return face_images

def save_images_to_database(images: list, output_dir: Path, employees_csv_path: Path):
    """Guardar imágenes en database_fotos y asociarlas con empleados."""
    output_dir.mkdir(exist_ok=True)
    
    # Cargar información de empleados del CSV
    employees = []
    if employees_csv_path.exists():
        import csv
        with open(employees_csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                employees.append({
                    'employee_id': int(row.get('employee_id', 0)),
                    'nombre': row.get('nombre', ''),
                    'zona': row.get('zona', ''),
                    'sucursal': row.get('sucursal', ''),
                    'puesto': row.get('puesto', '')
                })
    
    print(f"\nGuardando imagenes en {output_dir}...")
    print(f"Total empleados en CSV: {len(employees)}")
    print(f"Total imagenes extraidas: {len(images)}")
    
    saved_count = 0
    
    # Guardar cada imagen
    for idx, (page_num, img_pil) in enumerate(images):
        try:
            # Determinar employee_id
            if idx < len(employees):
                employee_id = employees[idx]['employee_id']
                nombre = employees[idx]['nombre']
            else:
                # Si hay más imágenes que empleados, usar índice + 1
                employee_id = idx + 1
                nombre = f"Empleado {employee_id}"
            
            # Guardar como JPG
            output_path = output_dir / f"photo_{employee_id}.jpg"
            
            # Convertir a RGB si es necesario
            if img_pil.mode != 'RGB':
                img_pil = img_pil.convert('RGB')
            
            # Guardar imagen
            img_pil.save(output_path, 'JPEG', quality=95)
            
            print(f"  [OK] Guardada: {output_path.name} -> {nombre} (pagina {page_num+1})")
            saved_count += 1
            
        except Exception as e:
            print(f"  [ERROR] Error guardando imagen {idx+1}: {e}")
            continue
    
    print(f"\n[OK] {saved_count} imagenes guardadas en {output_dir}")
    
    # Mostrar resumen
    if employees:
        print(f"\nResumen de asociaciones:")
        for idx in range(min(len(images), len(employees))):
            emp = employees[idx]
            print(f"  photo_{emp['employee_id']}.jpg -> {emp['nombre']} ({emp['zona']}, {emp['sucursal']})")

def main():
    """Función principal."""
    print("="*60)
    print("EXTRACCION DE FOTOS DEL PDF")
    print("="*60)
    print()
    
    base_dir = Path(__file__).parent
    pdf_path = base_dir / "plantilla_personal_por_zona_sucursal.pdf"
    output_dir = base_dir / "database_fotos"
    employees_csv = base_dir / "employees_from_pdf.csv"
    
    if not pdf_path.exists():
        print(f"[ERROR] No se encontro el PDF: {pdf_path}")
        return
    
    # Verificar si existe el CSV de empleados
    if not employees_csv.exists():
        print(f"[WARNING] No se encontro el CSV de empleados: {employees_csv}")
        print("  Ejecuta primero: python extract_employees_from_pdf.py")
        respuesta = input("  ¿Continuar de todas formas? (s/n): ").lower()
        if respuesta != 's':
            return
    
    try:
        # Extraer imágenes
        images = extract_images_from_pdf(pdf_path)
        
        if not images:
            print("[ERROR] No se pudieron extraer imagenes del PDF")
            return
        
        # Filtrar imágenes de caras
        face_images = filter_face_images(images)
        
        if not face_images:
            print("[WARNING] No se encontraron imagenes de caras")
            print("  Guardando todas las imagenes de todas formas...")
            face_images = images
        
        # Guardar imágenes
        save_images_to_database(face_images, output_dir, employees_csv)
        
        print("\n" + "="*60)
        print("[OK] EXTRACCION DE FOTOS COMPLETADA")
        print("="*60)
        print(f"\nLas fotos estan en: {output_dir}")
        print("\nSiguiente paso:")
        print("  python train_face_model_interactive.py")
        
    except Exception as e:
        print(f"\n[ERROR] Error durante la extraccion: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

