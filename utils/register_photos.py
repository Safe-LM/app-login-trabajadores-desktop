"""
Script para registrar fotos de trabajadores en el sistema de reconocimiento facial.
Carga las fotos de database_fotos/ y las convierte a embeddings.
"""
import sys
import builtins
from pathlib import Path
import cv2
import numpy as np

# Agregar paths necesarios
root_path = Path(__file__).parent.parent.parent
app_web_path = root_path / "app_loginTrabajadores" / "backend"
deteccion_path = root_path / "deteccion_vision_demo1"

if str(app_web_path) not in sys.path:
    sys.path.insert(0, str(app_web_path))
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

# Interceptar input() y sys.exit() para evitar que el sistema de seguridad bloquee
# si falta el módulo 'lap' (que es opcional)
_original_input = builtins.input
_original_exit = sys.exit

def _mock_input(prompt=""):
    return ""

def _mock_exit(code=0):
    # No hacer nada, solo continuar
    pass

# Aplicar mocks antes de importar demo_seguridad
builtins.input = _mock_input
sys.exit = _mock_exit

def register_photos_from_database():
    """Registrar todas las fotos de database_fotos/ en el sistema de reconocimiento."""
    try:
        # Importar sistema de seguridad (con mocks aplicados para evitar bloqueos)
        try:
            import deteccion_vision_demo1.demo_seguridad as ds
        except SystemExit:
            # Si el sistema intentó salir, restaurar funciones y reintentar
            builtins.input = _original_input
            sys.exit = _original_exit
            import deteccion_vision_demo1.demo_seguridad as ds
        except Exception as e:
            # Si hay otro error, restaurar funciones y relanzar
            builtins.input = _original_input
            sys.exit = _original_exit
            raise e
        
        # Restaurar funciones originales después de importar
        builtins.input = _original_input
        sys.exit = _original_exit
        
        # Inicializar OSNet si no está inicializado
        if ds.modelo_osnet is None:
            print("📦 Inicializando OSNet...")
            ds.inicializar_osnet()
        
        # Inicializar YOLO
        from ultralytics import YOLO
        modelo_yolo = YOLO('yolo11s.pt')
        
        # Directorio de fotos
        base_dir = Path(__file__).parent.parent
        database_fotos_dir = base_dir / "database_fotos"
        
        if not database_fotos_dir.exists():
            print(f"❌ No se encontró la carpeta: {database_fotos_dir}")
            return False
        
        # Buscar todas las fotos JPG
        foto_files = list(database_fotos_dir.glob("*.jpg")) + list(database_fotos_dir.glob("*.jpeg")) + list(database_fotos_dir.glob("*.png"))
        
        if not foto_files:
            print(f"❌ No se encontraron fotos en: {database_fotos_dir}")
            return False
        
        print(f"📸 Encontradas {len(foto_files)} fotos para registrar")
        print("=" * 50)
        
        # Limpiar embeddings existentes para empezar fresco
        ds.embeddings_empleados = []
        print("🔄 Limpiando embeddings anteriores...")
        
        registered_count = 0
        
        for foto_file in sorted(foto_files):
            try:
                # Leer imagen
                img = cv2.imread(str(foto_file))
                if img is None:
                    print(f"⚠️ No se pudo leer: {foto_file.name}")
                    continue
                
                print(f"📷 Procesando: {foto_file.name}...")
                
                # Detectar persona con YOLO
                results = modelo_yolo(img, classes=[0], verbose=False)
                
                # Buscar la mejor detección
                mejor_bbox = None
                mejor_conf = 0.0
                
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        conf = float(box.conf)
                        if conf > mejor_conf:
                            mejor_conf = conf
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            mejor_bbox = (int(x1), int(y1), int(x2), int(y2))
                
                if mejor_bbox is None:
                    # Si no hay detección, usar toda la imagen
                    mejor_bbox = (0, 0, img.shape[1], img.shape[0])
                    print(f"  ⚠️ No se detectó persona con YOLO, usando imagen completa")
                else:
                    print(f"  ✅ YOLO detectó persona (confianza: {mejor_conf:.2f})")
                
                # Extraer embedding mejorado (esto es el "entrenamiento" - extrae características)
                print(f"  🔍 Extrayendo embedding mejorado...")
                try:
                    from utils.improved_face_recognition import extraer_embedding_mejorado
                    embedding = extraer_embedding_mejorado(img, mejor_bbox)
                except ImportError:
                    # Fallback al método original
                    embedding = ds.extraer_embedding(img, mejor_bbox)
                
                if embedding is None:
                    print(f"  ❌ No se pudo extraer embedding")
                    continue
                
                # Verificar tipo de embedding
                embedding_type = "OSNet" if ds.modelo_osnet is not None else "Histograma HSV"
                embedding_size = len(embedding) if hasattr(embedding, '__len__') else "N/A"
                print(f"  📊 Embedding extraído: Tipo={embedding_type}, Tamaño={embedding_size}")
                
                # Agregar a embeddings (esto es el "registro" en la base de datos)
                idx = len(ds.embeddings_empleados)
                ds.embeddings_empleados.append(embedding)
                
                # Extraer employee_id del nombre del archivo (photo_1.jpg -> 1)
                import re
                match = re.search(r'(\d+)', foto_file.stem)
                employee_id = int(match.group(1)) if match else idx + 1
                
                print(f"  ✅ Registrado: embedding_idx={idx}, employee_id={employee_id}")
                print()
                registered_count += 1
                
            except Exception as e:
                print(f"❌ Error procesando {foto_file.name}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        # Guardar embeddings en disco (esto persiste el "entrenamiento")
        if registered_count > 0:
            ds.guardar_embeddings_dia(ds.embeddings_empleados)
            print("=" * 50)
            print(f"✅ {registered_count} fotos registradas exitosamente")
            print(f"📦 Embeddings guardados en disco")
            print(f"💡 Ahora el sistema puede reconocer a estos {registered_count} trabajadores")
            return True
        else:
            print("❌ No se registró ninguna foto")
            return False
            
    except Exception as e:
        print(f"❌ Error en registro de fotos: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("REGISTRO DE FOTOS EN SISTEMA DE RECONOCIMIENTO")
    print("=" * 50)
    print()
    
    try:
        success = register_photos_from_database()
        if success:
            print()
            print("✅ Proceso completado exitosamente")
        else:
            print()
            print("❌ Proceso completado con errores")
    except KeyboardInterrupt:
        print()
        print("⚠️ Proceso cancelado por el usuario")
    except Exception as e:
        print()
        print(f"❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Asegurar que las funciones originales estén restauradas
        builtins.input = _original_input
        sys.exit = _original_exit

