"""
Utilidades para reconocimiento facial.
Reutiliza el sistema de reconocimiento facial de la aplicación web.
Carga perezosa para optimizar tiempo de inicio.
"""
import sys
from pathlib import Path
import numpy as np
import cv2

# Variables globales para carga perezosa
_face_recognition_loaded = False
_inicializar_sistema_facial = None
_reconocer_trabajador = None
_registrar_rostro_trabajador = None
FACE_RECOGNITION_AVAILABLE = False

def _load_face_recognition_module():
    """Cargar módulo de reconocimiento facial de forma perezosa."""
    global _face_recognition_loaded, _inicializar_sistema_facial
    global _reconocer_trabajador, _registrar_rostro_trabajador, FACE_RECOGNITION_AVAILABLE
    
    if _face_recognition_loaded:
        return
    
    try:
        # Agregar el path de la app web
        app_web_path = Path(__file__).parent.parent.parent / "app_loginTrabajadores" / "backend"
        if str(app_web_path) not in sys.path:
            sys.path.insert(0, str(app_web_path))
        
        # Importar funciones de reconocimiento facial
        from face_recognition import (
            inicializar_sistema_facial as _init,
            reconocer_trabajador as _reconocer,
            registrar_rostro_trabajador as _registrar
        )
        
        _inicializar_sistema_facial = _init
        _reconocer_trabajador = _reconocer
        _registrar_rostro_trabajador = _registrar
        FACE_RECOGNITION_AVAILABLE = True
        _face_recognition_loaded = True
        
    except ImportError as e:
        print(f"⚠️ No se pudo importar el sistema de reconocimiento facial: {e}")
        FACE_RECOGNITION_AVAILABLE = False
        _face_recognition_loaded = True
    except Exception as e:
        print(f"⚠️ Error cargando sistema de reconocimiento facial: {e}")
        FACE_RECOGNITION_AVAILABLE = False
        _face_recognition_loaded = True

def inicializar_sistema_facial():
    """Inicializar sistema de reconocimiento facial y cargar embeddings."""
    _load_face_recognition_module()
    
    if not FACE_RECOGNITION_AVAILABLE or _inicializar_sistema_facial is None:
        return False
    
    try:
        result = _inicializar_sistema_facial()
        
        # Asegurar que los embeddings se carguen
        if result:
            try:
                import deteccion_vision_demo1.demo_seguridad as ds
                # Cargar embeddings si no están cargados
                if not ds.embeddings_empleados:
                    print("📦 Cargando embeddings guardados...")
                    ds.cargar_embeddings_dia()
                    ds.cargar_embeddings_multiples()
                    if ds.embeddings_empleados:
                        print(f"✅ {len(ds.embeddings_empleados)} embedding(s) cargados")
                    else:
                        print("⚠️ No hay embeddings guardados. Ejecuta registrar_fotos.py primero.")
            except Exception as e:
                print(f"⚠️ Error cargando embeddings: {e}")
        
        return result
    except Exception as e:
        print(f"Error inicializando sistema: {e}")
        import traceback
        traceback.print_exc()
        return False

def reconocer_desde_frame(frame: np.ndarray, trabajador_id: int = None, embedding_idx: int = None):
    """Reconocer trabajador desde un frame de OpenCV."""
    _load_face_recognition_module()
    
    if not FACE_RECOGNITION_AVAILABLE or _reconocer_trabajador is None:
        return False, 0.0, None
    
    try:
        # Buscar en toda la base de datos si no se especifica trabajador
        reconocido, confianza, idx = _reconocer_trabajador(
            frame,
            trabajador_id=trabajador_id,
            embedding_idx=embedding_idx,
            umbral=0.85,
            buscar_todos=True  # Buscar en toda la base de datos
        )
        return reconocido, confianza, idx
    except Exception as e:
        print(f"Error en reconocimiento: {e}")
        return False, 0.0, None

def reconocer_automatico(frame: np.ndarray):
    """Reconocer automáticamente cualquier trabajador en el frame (busca en toda la BD)."""
    _load_face_recognition_module()
    
    if not FACE_RECOGNITION_AVAILABLE or _reconocer_trabajador is None:
        return False, 0.0, None
    
    try:
        # Importar ds para verificar embeddings
        import deteccion_vision_demo1.demo_seguridad as ds
        from ultralytics import YOLO
        
        # Verificar que hay embeddings cargados
        if not hasattr(ds, 'embeddings_empleados') or len(ds.embeddings_empleados) == 0:
            print("[WARNING] No hay embeddings cargados. Ejecuta registrar_fotos.py primero.")
            return False, 0.0, None
        
        # Usar sistema mejorado si está disponible
        try:
            from utils.improved_face_recognition import extraer_embedding_mejorado, comparar_embeddings_mejorado
            
            # Detectar persona con YOLO primero en la carpeta de modelos
            PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
            modelo_path = PROJECT_ROOT / "data" / "models" / "yolo11s.pt"
            modelo_yolo = YOLO(str(modelo_path))
            results = modelo_yolo(frame, classes=[0], verbose=False)
            
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
                # Si no detecta persona, usar frame completo
                mejor_bbox = (0, 0, frame.shape[1], frame.shape[0])
            
            # Extraer embedding mejorado del frame
            embedding_actual = extraer_embedding_mejorado(frame, mejor_bbox)
            
            if embedding_actual is None:
                return False, 0.0, None
            
            # Comparar con todos los embeddings registrados
            mejor_similitud = 0.0
            mejor_idx = None
            
            for idx, emb_registrado in enumerate(ds.embeddings_empleados):
                similitud = comparar_embeddings_mejorado(embedding_actual, emb_registrado)
                if similitud > mejor_similitud:
                    mejor_similitud = similitud
                    mejor_idx = idx
            
            # Umbral reducido a 0.50 para facilitar reconocimiento
            reconocido = mejor_similitud >= 0.50
            confianza = mejor_similitud
            
            print(f"[DEBUG] Reconocimiento mejorado: reconocido={reconocido}, confianza={confianza:.3f}, idx={mejor_idx}, embeddings_disponibles={len(ds.embeddings_empleados)}")
            
            return reconocido, confianza, mejor_idx
            
        except ImportError:
            # Fallback al método original
            reconocido, confianza, idx = _reconocer_trabajador(
                frame,
                trabajador_id=None,
                embedding_idx=None,
                umbral=0.50,  # Umbral más bajo para facilitar reconocimiento
                buscar_todos=True
            )
            print(f"[DEBUG] Reconocimiento: reconocido={reconocido}, confianza={confianza:.3f}, idx={idx}, embeddings_disponibles={len(ds.embeddings_empleados)}")
            return reconocido, confianza, idx
        
    except Exception as e:
        print(f"Error en reconocimiento automático: {e}")
        import traceback
        traceback.print_exc()
        return False, 0.0, None
