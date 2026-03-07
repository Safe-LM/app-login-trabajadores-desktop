"""
Sistema robusto de matching foto a foto para reconocimiento de trabajadores.
Diseñado para detectar cuando se muestra una foto enfrente de la cámara y hacer match con la BD.
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, List
import json
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Importaciones opcionales
_torch_available = None
_torch = None
_face_recognition_available = None
_face_recognition = None

def _check_dependencies():
    """Verificar dependencias disponibles. Cachea resultados para no reintentar."""
    global _torch_available, _torch, _face_recognition_available, _face_recognition
    
    if _torch_available is None:
        try:
            import torch
            _torch = torch
            _torch_available = True
            logger.info("PyTorch disponible")
        except Exception as e:
            _torch_available = False
            if "1114" in str(e) or "DLL" in str(e):
                logger.warning("PyTorch no disponible (error DLL de Windows)")
            else:
                logger.warning(f"PyTorch no disponible: {type(e).__name__}")
    
    if _face_recognition_available is None:
        try:
            import face_recognition
            _face_recognition = face_recognition
            _face_recognition_available = True
            logger.info("face_recognition disponible")
        except Exception as e:
            _face_recognition_available = False
            logger.info(f"face_recognition no disponible (opcional): {type(e).__name__}")
    
    return _torch_available, _face_recognition_available


class PhotoMatcher:
    """Sistema robusto de matching foto a foto."""
    
    def __init__(self, database_dir: Optional[Path] = None, lazy_load_dependencies: bool = True):
        """
        Inicializar el matcher.
        
        Args:
            database_dir: Directorio de la base de datos de fotos
            lazy_load_dependencies: Cargar dependencias pesadas solo cuando se necesiten
        """
        if database_dir is None:
            database_dir = Path(__file__).parent.parent / "database_fotos"
        self.database_dir = Path(database_dir)
        self.json_path = self.database_dir / "json" / "employees_db.json"
        
        # Cargar base de datos de empleados
        self.employees_db = self._load_employees_db()
        
        # Inicializar detectores (ligeros, no bloquean)
        try:
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
        except Exception as e:
            logger.warning(f"Error cargando Haar Cascade: {e}")
            self.face_cascade = None
        
        # Verificar dependencias SOLO si no es lazy load (para evitar bloqueos)
        if lazy_load_dependencies:
            self.torch_available = None  # Se verificará cuando se necesite
            self.face_recognition_available = None  # Se verificará cuando se necesite
        else:
            self.torch_available, self.face_recognition_available = _check_dependencies()
        
        # Cache de encodings de la BD
        self._encoding_cache = {}
        
        logger.info(f"✅ PhotoMatcher inicializado con {len(self.employees_db)} empleados")
    
    def _load_employees_db(self) -> List[Dict]:
        """Cargar base de datos de empleados."""
        try:
            if self.json_path.exists():
                with open(self.json_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                logger.warning(f"⚠️ No se encontró {self.json_path}")
                return []
        except Exception as e:
            logger.error(f"❌ Error cargando BD de empleados: {e}")
            return []
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocesar imagen para mejorar detección con filtros avanzados (antireflejo, mejora de calidad).
        
        Args:
            image: Imagen BGR de OpenCV
        
        Returns:
            Imagen preprocesada
        """
        if image is None or image.size == 0:
            return image
        
        try:
            # ============================================================
            # FILTRO 1: Reducción de reflejos y brillos (antireflejo)
            # ============================================================
            # Convertir a LAB para trabajar en canal L (luminosidad)
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            
            # Detectar y reducir reflejos brillantes
            # Usar umbral adaptativo para identificar áreas muy brillantes
            _, bright_mask = cv2.threshold(l, 220, 255, cv2.THRESH_BINARY)
            
            # Aplicar inpainting para rellenar áreas brillantes (reflejos)
            if np.any(bright_mask):
                # Dilatar máscara para cubrir mejor los reflejos
                kernel = np.ones((5, 5), np.uint8)
                bright_mask = cv2.dilate(bright_mask, kernel, iterations=1)
                
                # Inpainting para eliminar reflejos
                l_inpainted = cv2.inpaint(l, bright_mask, 3, cv2.INPAINT_TELEA)
                l = l_inpainted
            
            # ============================================================
            # FILTRO 2: Ecualización adaptativa mejorada (CLAHE)
            # ============================================================
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            l_enhanced = clahe.apply(l)
            
            # ============================================================
            # FILTRO 3: Reducción de ruido avanzada
            # ============================================================
            # Bilateral filter para preservar bordes y reducir ruido
            l_denoised = cv2.bilateralFilter(l_enhanced, 9, 75, 75)
            
            # ============================================================
            # FILTRO 4: Mejora de contraste suave
            # ============================================================
            # Aplicar contraste adaptativo (evitar sobre-exposición)
            l_final = cv2.convertScaleAbs(l_denoised, alpha=1.1, beta=5)
            
            # Reconstruir imagen LAB
            lab_processed = cv2.merge([l_final, a, b])
            
            # Convertir de vuelta a BGR
            result = cv2.cvtColor(lab_processed, cv2.COLOR_LAB2BGR)
            
            # ============================================================
            # FILTRO 5: Reducción de ruido final en color
            # ============================================================
            result = cv2.bilateralFilter(result, 5, 50, 50)
            
            return result
            
        except Exception as e:
            logger.debug(f"Error en preprocesamiento avanzado: {e}, usando método simple")
            # Fallback a método simple si falla
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            denoised = cv2.bilateralFilter(enhanced, 5, 50, 50)
            
            if len(image.shape) == 3:
                denoised = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
            
            return denoised
    
    def _detect_face_robust(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detectar rostro de forma robusta usando múltiples métodos (optimizado).
        
        Args:
            image: Imagen BGR
        
        Returns:
            (x, y, w, h) o None
        """
        if image is None or image.size == 0:
            return None
        
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            
            # Reducir tamaño para detección más rápida si es muy grande
            h, w = gray.shape[:2]
            if h > 480 or w > 640:
                scale = min(480/h, 640/w)
                new_w = int(w * scale)
                new_h = int(h * scale)
                gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
                scale_factor = 1.0 / scale
            else:
                scale_factor = 1.0
            
            # Método 1: Haar Cascade (rápido)
            if self.face_cascade is None:
                return None
                
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.15,  # Más rápido
                minNeighbors=4,    # Menos estricto = más rápido
                minSize=(80, 80),  # Más pequeño = más rápido
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            if len(faces) > 0:
                # Tomar el rostro más grande
                largest_face = max(faces, key=lambda f: f[2] * f[3])
                x, y, w, h = largest_face
                # Escalar de vuelta si se redimensionó
                x = int(x * scale_factor)
                y = int(y * scale_factor)
                w = int(w * scale_factor)
                h = int(h * scale_factor)
                return (x, y, x + w, y + h)
        except Exception as e:
            logger.debug(f"Error en detección de rostro: {e}")
            return None
        
        # Método 2: DNN Face Detector (más preciso, si está disponible)
        try:
            # Cargar modelo DNN de OpenCV
            net = cv2.dnn.readNetFromTensorflow(
                str(Path(__file__).parent.parent / "models" / "opencv_face_detector_uint8.pb"),
                str(Path(__file__).parent.parent / "models" / "opencv_face_detector.pbtxt")
            )
            
            h_img, w_img = image.shape[:2]
            blob = cv2.dnn.blobFromImage(image, 1.0, (300, 300), [104, 117, 123])
            net.setInput(blob)
            detections = net.forward()
            
            best_face = None
            best_conf = 0.5
            
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > best_conf:
                    x1 = int(detections[0, 0, i, 3] * w_img)
                    y1 = int(detections[0, 0, i, 4] * h_img)
                    x2 = int(detections[0, 0, i, 5] * w_img)
                    y2 = int(detections[0, 0, i, 6] * h_img)
                    best_face = (x1, y1, x2, y2)
                    best_conf = confidence
            
            if best_face:
                return best_face
        except Exception as e:
            logger.debug(f"DNN detector no disponible: {e}")
        
        return None
    
    def _extract_face_features_opencv(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Extraer características del rostro usando OpenCV.
        
        Args:
            face_image: Imagen del rostro recortada
        
        Returns:
            Vector de características o None
        """
        try:
            # Redimensionar a tamaño estándar
            face_resized = cv2.resize(face_image, (128, 128))
            
            # Convertir a escala de grises
            gray = cv2.cvtColor(face_resized, cv2.COLOR_BGR2GRAY) if len(face_resized.shape) == 3 else face_resized
            
            # Histograma de gradientes orientados (HOG)
            hog = cv2.HOGDescriptor((64, 64), (16, 16), (8, 8), (8, 8), 9)
            features = hog.compute(gray)
            
            # Histograma de color
            hist_b = cv2.calcHist([face_resized], [0], None, [32], [0, 256])
            hist_g = cv2.calcHist([face_resized], [1], None, [32], [0, 256])
            hist_r = cv2.calcHist([face_resized], [2], None, [32], [0, 256])
            
            # Normalizar histogramas
            cv2.normalize(hist_b, hist_b)
            cv2.normalize(hist_g, hist_g)
            cv2.normalize(hist_r, hist_r)
            
            # Concatenar características
            combined = np.concatenate([
                features.flatten(),
                hist_b.flatten(),
                hist_g.flatten(),
                hist_r.flatten()
            ])
            
            # Normalizar
            norm = np.linalg.norm(combined)
            if norm > 0:
                combined = combined / norm
            
            return combined
        except Exception as e:
            logger.error(f"Error extrayendo características OpenCV: {e}")
            return None
    
    def _extract_face_features_face_recognition(self, face_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Extraer características usando face_recognition (más preciso).
        
        Args:
            face_image: Imagen del rostro recortada (BGR)
        
        Returns:
            Encoding de 128 dimensiones o None
        """
        # Verificar dependencia solo cuando se necesite (lazy load)
        if self.face_recognition_available is None:
            _, self.face_recognition_available = _check_dependencies()
        
        if not self.face_recognition_available or _face_recognition is None:
            return None
        
        try:
            # Convertir BGR a RGB
            rgb_image = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
            
            # Detectar landmarks y extraer encoding
            face_encodings = _face_recognition.face_encodings(rgb_image)
            
            if len(face_encodings) > 0:
                return face_encodings[0]
            else:
                return None
        except Exception as e:
            logger.debug(f"Error en face_recognition: {e}")
            return None
    
    def _get_employee_encoding(self, employee_id: int, method: str = "face_recognition") -> Optional[np.ndarray]:
        """
        Obtener encoding de un empleado (con cache).
        
        Args:
            employee_id: ID del empleado
            method: "face_recognition" o "opencv"
        
        Returns:
            Encoding o None
        """
        cache_key = f"{employee_id}_{method}"
        
        if cache_key in self._encoding_cache:
            return self._encoding_cache[cache_key]
        
        # Buscar empleado en BD
        employee = next((e for e in self.employees_db if e.get('employee_id') == employee_id), None)
        if not employee:
            return None
        
        # Cargar foto
        photo_file = employee.get('photo_file', '')
        if not photo_file:
            return None
        
        photo_path = self.database_dir / photo_file
        if not photo_path.exists():
            return None
        
        try:
            # Cargar imagen
            img = cv2.imread(str(photo_path))
            if img is None:
                return None
            
            # Preprocesar
            img = self._preprocess_image(img)
            
            # Detectar rostro
            bbox = self._detect_face_robust(img)
            if not bbox:
                return None
            
            x1, y1, x2, y2 = bbox
            face_img = img[y1:y2, x1:x2]
            
            # Extraer características según método
            if method == "face_recognition":
                encoding = self._extract_face_features_face_recognition(face_img)
            else:
                encoding = self._extract_face_features_opencv(face_img)
            
            # Guardar en cache
            if encoding is not None:
                self._encoding_cache[cache_key] = encoding
            
            return encoding
        except Exception as e:
            logger.error(f"Error obteniendo encoding de empleado {employee_id}: {e}")
            return None
    
    def _compare_features(self, feat1: np.ndarray, feat2: np.ndarray) -> float:
        """
        Comparar dos vectores de características.
        
        Args:
            feat1, feat2: Vectores de características
        
        Returns:
            Similitud (0-1, 1 = idéntico)
        """
        try:
            # Distancia coseno
            dot_product = np.dot(feat1, feat2)
            norm1 = np.linalg.norm(feat1)
            norm2 = np.linalg.norm(feat2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            cosine_sim = dot_product / (norm1 * norm2)
            
            # Normalizar a 0-1 (coseno puede ser -1 a 1)
            similarity = (cosine_sim + 1) / 2
            
            return float(similarity)
        except Exception as e:
            logger.error(f"Error comparando características: {e}")
            return 0.0
    
    def match_photo_to_database(
        self,
        frame: np.ndarray,
        min_confidence: float = 0.75,
        use_multiple_methods: bool = True
    ) -> Tuple[bool, float, Optional[Dict]]:
        """
        Hacer match de una foto mostrada en la cámara con la base de datos.
        
        Args:
            frame: Frame de la cámara (BGR)
            min_confidence: Confianza mínima para considerar match
            use_multiple_methods: Usar múltiples métodos y consenso
        
        Returns:
            (matched, confidence, employee_info)
        """
        try:
            # Preprocesar imagen
            processed = self._preprocess_image(frame)
            
            # Detectar rostro
            bbox = self._detect_face_robust(processed)
            if not bbox:
                logger.debug("No se detectó rostro en el frame")
                return False, 0.0, None
            
            x1, y1, x2, y2 = bbox
            face_img = processed[y1:y2, x1:x2]
            
            # Extraer características con múltiples métodos
            features_list = []
            
            # Método 1: face_recognition (si está disponible)
            if self.face_recognition_available is not False:
                feat_fr = self._extract_face_features_face_recognition(face_img)
                if feat_fr is not None:
                    features_list.append(("face_recognition", feat_fr))
            
            # Método 2: OpenCV (siempre disponible)
            feat_cv = self._extract_face_features_opencv(face_img)
            if feat_cv is not None:
                features_list.append(("opencv", feat_cv))
            
            if not features_list:
                logger.warning("No se pudieron extraer características")
                return False, 0.0, None
            
            # Comparar con todos los empleados
            best_match = None
            best_confidence = 0.0
            best_employee = None
            
            for employee in self.employees_db:
                employee_id = employee.get('employee_id')
                if not employee_id:
                    continue
                
                # Comparar con cada método disponible
                confidences = []
                
                for method_name, query_features in features_list:
                    # Obtener encoding del empleado
                    employee_encoding = self._get_employee_encoding(employee_id, method_name)
                    if employee_encoding is None:
                        continue
                    
                    # Comparar
                    similarity = self._compare_features(query_features, employee_encoding)
                    confidences.append(similarity)
                
                # Calcular confianza combinada
                if confidences:
                    if use_multiple_methods and len(confidences) > 1:
                        # Promedio ponderado (face_recognition tiene más peso)
                        if len(confidences) == 2:
                            combined_conf = confidences[0] * 0.7 + confidences[1] * 0.3
                        else:
                            combined_conf = np.mean(confidences)
                    else:
                        combined_conf = confidences[0]
                    
                    if combined_conf > best_confidence:
                        best_confidence = combined_conf
                        best_match = employee_id
                        best_employee = employee.copy()
            
            # Verificar si supera el umbral
            if best_confidence >= min_confidence and best_employee:
                logger.info(f"✅ Match encontrado: {best_employee.get('nombre')} (confianza: {best_confidence:.3f})")
                return True, best_confidence, best_employee
            else:
                logger.debug(f"No se encontró match (mejor confianza: {best_confidence:.3f})")
                return False, best_confidence, None
                
        except cv2.error as e:
            logger.error(f"❌ Error de OpenCV en match_photo_to_database: {e}")
            return False, 0.0, None
        except ValueError as e:
            logger.error(f"❌ Error de valor en match_photo_to_database: {e}")
            return False, 0.0, None
        except Exception as e:
            logger.error(f"❌ Error inesperado en match_photo_to_database: {type(e).__name__}: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False, 0.0, None


# Instancia global (carga perezosa)
_photo_matcher = None

def get_photo_matcher(database_dir: Optional[Path] = None, lazy_load: bool = True) -> Optional[PhotoMatcher]:
    """Obtener instancia global del matcher (con lazy load para evitar bloqueos)."""
    global _photo_matcher
    
    if _photo_matcher is None:
        try:
            _photo_matcher = PhotoMatcher(database_dir, lazy_load_dependencies=lazy_load)
        except Exception as e:
            logger.error(f"Error inicializando PhotoMatcher: {e}")
            return None
    
    return _photo_matcher

def match_photo_from_frame(
    frame: np.ndarray,
    min_confidence: float = 0.75,
    database_dir: Optional[Path] = None
) -> Tuple[bool, float, Optional[Dict]]:
    """
    Función de conveniencia para hacer match desde un frame.
    
    Args:
        frame: Frame de la cámara
        min_confidence: Confianza mínima
        database_dir: Directorio de BD (opcional)
    
    Returns:
        (matched, confidence, employee_info)
    """
    try:
        # Usar lazy_load=True para evitar cargar dependencias pesadas al inicio
        matcher = get_photo_matcher(database_dir, lazy_load=True)
        if matcher is None:
            return False, 0.0, None
        
        return matcher.match_photo_to_database(frame, min_confidence)
    except Exception as e:
        logger.error(f"Error en match_photo_from_frame: {e}")
        return False, 0.0, None

